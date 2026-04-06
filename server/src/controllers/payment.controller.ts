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
  batchId: z.string().optional(),
});

const verifySchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
  batchId: z.string().optional(),
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

    const { bookingId, batchId } = parseResult.data;
    const prisma = request.server.prisma;

    // If batch payment, get all bookings in the batch
    let bookings: any[];
    if (batchId) {
      bookings = await prisma.booking.findMany({
        where: { batchId, userId: request.user.id },
        include: { payment: true, slot: { include: { facility: true } } },
      });
      if (!bookings.length) httpError('No bookings found for this batch', 404);
    } else {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { payment: true, slot: { include: { facility: true } } },
      });
      if (!booking) httpError('Booking not found', 404);
      if (booking!.userId !== request.user.id) {
        httpError('You do not have access to this booking', 403);
      }
      bookings = [booking];
    }

    // Validate all bookings
    for (const b of bookings) {
      if (b.status !== 'PENDING') httpError(`Booking already ${b.status}`, 400);
      if (b.paymentMethod !== 'ONLINE') httpError('Booking uses offline payment', 400);
      if (!b.payment) httpError('Payment record not found', 500);
    }

    const firstPayment = bookings[0].payment;

    // If order already created, return it
    if (firstPayment.razorpayOrderId && firstPayment.status === 'PENDING') {
      const totalAmount = bookings.reduce((sum: number, b: any) => sum + b.payment.amount, 0);
      return success(
        {
          razorpayOrderId: firstPayment.razorpayOrderId,
          amount: totalAmount,
          currency: firstPayment.currency,
          keyId: process.env.RAZORPAY_KEY_ID,
          bookingId: bookings[0].id,
          batchId: batchId || null,
        },
        'Razorpay order already exists',
      );
    }

    if (firstPayment.status === 'SUCCESS') {
      httpError('Payment has already been completed', 400);
    }

    // Calculate total amount for all bookings
    const totalAmount = bookings.reduce((sum: number, b: any) => sum + b.payment.amount, 0);

    // Create single Razorpay order for total
    let order: { id: string };
    try {
      order = await PaymentService.createOrder(totalAmount, batchId || bookingId);
    } catch (err: any) {
      const msg = err?.error?.description || err?.message || 'Razorpay order creation failed';
      httpError(`Payment gateway error: ${msg}`, 502);
    }

    // Save order ID to ALL payment records in the batch
    for (const b of bookings) {
      await prisma.payment.update({
        where: { id: b.payment.id },
        data: { razorpayOrderId: order!.id },
      });
    }

    reply.status(201);
    return success(
      {
        razorpayOrderId: order.id,
        amount: totalAmount,
        currency: firstPayment.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        bookingId: bookings[0].id,
        batchId: batchId || null,
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

    const { bookingId, batchId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      parseResult.data;
    const prisma = request.server.prisma;

    // Fetch bookings — single or batch
    let bookings: any[];
    if (batchId) {
      bookings = await prisma.booking.findMany({
        where: { batchId, userId: request.user.id },
        include: { payment: true },
      });
      if (!bookings.length) httpError('No bookings found for this batch', 404);
    } else {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { payment: true },
      });
      if (!booking) httpError('Booking not found', 404);
      if (booking!.userId !== request.user.id) {
        httpError('You do not have access to this booking', 403);
      }
      bookings = [booking];
    }

    const firstPayment = bookings[0].payment;
    if (!firstPayment) httpError('Payment record not found', 500);

    if (firstPayment.razorpayOrderId !== razorpayOrderId) {
      httpError('Order ID mismatch', 400);
    }

    if (firstPayment.status === 'SUCCESS') {
      return success(
        { booking: { id: bookings[0].id, status: bookings[0].status }, paymentStatus: 'SUCCESS' },
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
      for (const b of bookings) {
        if (b.payment) {
          await prisma.payment.update({
            where: { id: b.payment.id },
            data: { status: 'FAILED' },
          });
        }
      }
      httpError('Payment verification failed — invalid signature', 400);
    }

    // Signature valid — confirm ALL bookings + payments in the batch
    const result = await prisma.$transaction(async (tx: any) => {
      const now = new Date();
      for (const b of bookings) {
        await tx.payment.update({
          where: { id: b.payment.id },
          data: { razorpayPaymentId, razorpaySignature, status: 'SUCCESS', paidAt: now },
        });
        await tx.booking.update({
          where: { id: b.id },
          data: { status: 'CONFIRMED' },
        });
      }

      const updatedBooking = await tx.booking.findUnique({
        where: { id: bookings[0].id },
        include: { slot: { include: { facility: true } }, payment: true },
      });

      return { booking: updatedBooking, payment: updatedBooking.payment };
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
   * POST /api/payments/verify-extra
   * Body: { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
   * Verifies an extra payment made after a booking reschedule (price increase).
   */
  static async verifyExtra(request: FastifyRequest, reply: FastifyReply) {
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

    if (payment!.razorpayOrderId !== razorpayOrderId) {
      httpError('Order ID mismatch', 400);
    }

    // Verify HMAC signature
    const isValid = PaymentService.verifySignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      httpError('Payment verification failed — invalid signature', 400);
    }

    // Update payment with new razorpayPaymentId (the extra payment)
    // Keep status as SUCCESS, update paidAt to latest
    await prisma.payment.update({
      where: { id: payment!.id },
      data: {
        razorpayPaymentId,
        razorpaySignature,
        paidAt: new Date(),
      },
    });

    return success(
      {
        booking: { id: booking!.id, status: booking!.status },
        paymentStatus: 'SUCCESS',
      },
      'Extra payment verified',
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

    // Find payments by razorpayOrderId (may be multiple for batch bookings)
    const payments = await prisma.payment.findMany({
      where: { razorpayOrderId },
    });
    const payment = payments[0];

    if (!payment) {
      // Order not found — could be from a different system; acknowledge
      return reply.status(200).send({ success: true, message: 'Order not found, skipped' });
    }

    if (eventType === 'payment.captured') {
      // Update ALL payments sharing this order (batch bookings)
      const pendingPayments = payments.filter((p: any) => p.status !== 'SUCCESS');
      if (pendingPayments.length > 0) {
        await prisma.$transaction(async (tx: any) => {
          const now = new Date();
          for (const p of pendingPayments) {
            await tx.payment.update({
              where: { id: p.id },
              data: { razorpayPaymentId, status: 'SUCCESS', paidAt: now },
            });
            await tx.booking.update({
              where: { id: p.bookingId },
              data: { status: 'CONFIRMED' },
            });
          }
        });
      }
    } else if (eventType === 'payment.failed') {
      const pendingPayments = payments.filter((p: any) => p.status === 'PENDING');
      for (const p of pendingPayments) {
        await prisma.payment.update({
          where: { id: p.id },
          data: { razorpayPaymentId, status: 'FAILED' },
        });
      }
    }

    // Always return 200 to Razorpay so it doesn't retry
    return reply.status(200).send({ success: true, message: `Handled ${eventType}` });
  }
}
