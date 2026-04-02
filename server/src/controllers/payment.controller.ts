/**
 * PaymentController — Razorpay order creation and verification.
 */
import { FastifyReply, FastifyRequest } from 'fastify';

export class PaymentController {
  static async initiate(request: FastifyRequest, reply: FastifyReply) {
    // TODO: validate bookingId, create Razorpay order via PaymentService,
    //       return { razorpayOrderId, amount, currency, keyId }
    throw new Error('Not implemented');
  }

  static async verify(request: FastifyRequest, reply: FastifyReply) {
    // TODO: verify HMAC signature, update Payment record, confirm Booking
    throw new Error('Not implemented');
  }

  static async webhook(request: FastifyRequest, reply: FastifyReply) {
    // TODO: validate X-Razorpay-Signature header, handle payment.captured
    //       and payment.failed events
    throw new Error('Not implemented');
  }
}
