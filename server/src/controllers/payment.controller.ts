/**
 * PaymentController — Razorpay order creation, verification, and webhook handling.
 * Business logic for payment orchestration; uses PaymentService for Razorpay SDK calls.
 */
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PaymentService } from '../services/payment.service';
import { success } from '../utils/response';

// ── Validation schemas ────────────────────────────────────────

const initiateSchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
});

const verifySchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
  razorpayOrderId: z.string().min(1, 'razorpayOrderId is required'),
  razorpayPaymentId: z.string().min(1, 'razorpayPaymentId is required'),
  razorpaySignature: z.string().min(1, 'razorpaySignature is required'),
});

/** Throw an HTTP-aware error */
function httpError(message: string, statusCode: number): never {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  throw err;
}

// ── Controller ────────────────────────────────────────────────

export class PaymentController {
  /**
   * POST /api/payments/initiate
   * Body: { bookingId }
   * Creates a Razorpay order for a PENDING booking and returns order details.
   */
  static async initiate(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = initiateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        statusCode: 400,
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { bookingId } = parseResult.data;
    const prisma = request.server.prisma;

    // Fetch booking with payment
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true, slot: { include: { facility: true } } },
    });

    if (!booking) httpError('Booking not found', 404);

    // Only the booking owner can initiate payment
    if (booking!.userId !== request.user.id) {
      httpError('You do not have access to this booking', 403);
    }

    // Must be PENDING and ONLINE payment
    if (booking!.status !== 'PENDING') {
      httpError(`Cannot initiate payment for a ${booking!.status} booking`, 400);
    }
    if (booking!.paymentMethod !== 'ONLINE') {
      httpError('This booking uses offline payment', 400);
    }

    const payment = booking!.payment;
    if (!payment) httpError('Payment record not found for this booking', 500);

    // If order already created and payment still pending, return existing order
    if (payment!.razorpayOrderId && payment!.status === 'PENDING') {
      return success(
        {
          razorpayOrderId: payment!.razorpayOrderId,
          amount: payment!.amount,
          currency: payment!.currency,
          keyId: process.env.RAZORPAY_KEY_ID,
          bookingId: booking!.id,
        },
        'Razorpay order already exists',
      );
    }

    // If payment already succeeded, no need to initiate again
    if (payment!.status === 'SUCCESS') {
      httpError('Payment has already been completed for this booking', 400);
    }

    // Create Razorpay order
    let order: { id: string };
    try {
      order = await PaymentService.createOrder(payment!.amount, booking!.id);
    } catch (err: any) {
      const msg = err?.error?.description || err?.message || 'Razorpay order creation failed';
      httpError(`Payment gateway error: ${msg}`, 502);
    }

    // Save order ID to payment record
    await prisma.payment.update({
      where: { id: payment!.id },
      data: { razorpayOrderId: order!.id },
    });

    reply.status(201);
    return success(
      {
        razorpayOrderId: order.id,
        amount: payment!.amount,
        currency: payment!.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        bookingId: booking!.id,
      },
      'Razorpay order created',
    );
  }

  /**
   * POST /api/payments/verify
   * Body: { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
   * Verifies the Razorpay payment signature and confirms the booking.
   */
  static async verify(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = verifySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        statusCode: 400,
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      parseResult.data;
    const prisma = request.server.prisma;

    // Fetch booking and payment
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });

    if (!booking) httpError('Booking not found', 404);
    if (booking!.userId !== request.user.id) {
      httpError('You do not have access to this booking', 403);
    }

    const payment = booking!.payment;
    if (!payment) httpError('Payment record not found', 500);

    // Verify the order ID matches
    if (payment!.razorpayOrderId !== razorpayOrderId) {
      httpError('Order ID mismatch', 400);
    }

    // Already processed
    if (payment!.status === 'SUCCESS') {
      return success(
        { booking: { id: booking!.id, status: booking!.status }, paymentStatus: 'SUCCESS' },
        'Payment already verified',
      );
    }

    // Verify HMAC signature
    const isValid = PaymentService.verifySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      // Mark payment as failed
      await prisma.payment.update({
        where: { id: payment!.id },
        data: { status: 'FAILED' },
      });
      httpError('Payment verification failed — invalid signature', 400);
    }

    // Signature valid — confirm booking + payment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: payment!.id },
        data: {
          razorpayPaymentId,
          razorpaySignature,
          status: 'SUCCESS',
          paidAt: new Date(),
        },
      });

      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED' },
        include: { slot: { include: { facility: true } }, payment: true },
      });

      return { booking: updatedBooking, payment: updatedPayment };
    });

    return success(
      {
        booking: {
          id: result.booking.id,
          status: result.booking.status,
          slot: result.booking.slot,
        },
        paymentStatus: result.payment.status,
      },
      'Payment verified — booking confirmed',
    );
  }

  /**
   * POST /api/payments/webhook
   * Public endpoint — Razorpay sends payment events here.
   * Verifies X-Razorpay-Signature header, handles payment.captured and payment.failed.
   */
  static async webhook(request: FastifyRequest, reply: FastifyReply) {
    const signature = request.headers['x-razorpay-signature'] as string | undefined;

    if (!signature) {
      return reply.status(400).send({ success: false, error: 'Missing signature header' });
    }

    // Razorpay sends JSON — we need the raw body for HMAC verification
    const rawBody =
      typeof request.body === 'string' ? request.body : JSON.stringify(request.body);

    const isValid = PaymentService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return reply.status(400).send({ success: false, error: 'Invalid webhook signature' });
    }

    // Parse event payload
    const event = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const eventType: string = event?.event;
    const paymentEntity = event?.payload?.payment?.entity;

    if (!paymentEntity) {
      // Acknowledge but ignore events we don't understand
      return reply.status(200).send({ success: true, message: 'Event ignored' });
    }

    const razorpayOrderId: string | undefined = paymentEntity.order_id;
    const razorpayPaymentId: string | undefined = paymentEntity.id;

    if (!razorpayOrderId) {
      return reply.status(200).send({ success: true, message: 'No order_id, skipped' });
    }

    const prisma = request.server.prisma;

    // Find payment by razorpayOrderId
    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId },
    });

    if (!payment) {
      // Order not found — could be from a different system; acknowledge
      return reply.status(200).send({ success: true, message: 'Order not found, skipped' });
    }

    if (eventType === 'payment.captured') {
      // Only update if not already marked SUCCESS (idempotent)
      if (payment.status !== 'SUCCESS') {
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              razorpayPaymentId,
              status: 'SUCCESS',
              paidAt: new Date(),
            },
          });
          await tx.booking.update({
            where: { id: payment.bookingId },
            data: { status: 'CONFIRMED' },
          });
        });
      }
    } else if (eventType === 'payment.failed') {
      if (payment.status === 'PENDING') {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { razorpayPaymentId, status: 'FAILED' },
        });
      }
    }

    // Always return 200 to Razorpay so it doesn't retry
    return reply.status(200).send({ success: true, message: `Handled ${eventType}` });
  }
}
