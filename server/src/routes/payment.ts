import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/authenticate';

const paymentRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/payments/initiate
   * Auth required — create a Razorpay order for a booking
   * Body: { bookingId }
   */
  fastify.post('/initiate', { preHandler: [authenticate] }, async (request, reply) => {
    // TODO: PaymentController.initiate
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * POST /api/payments/verify
   * Auth required — verify Razorpay payment signature after checkout
   * Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId }
   */
  fastify.post('/verify', { preHandler: [authenticate] }, async (request, reply) => {
    // TODO: PaymentController.verify
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * POST /api/payments/webhook
   * Public — Razorpay webhook endpoint (verified via signature header)
   * Register this URL in Razorpay dashboard
   */
  fastify.post('/webhook', async (request, reply) => {
    // TODO: PaymentController.webhook
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });
};

export default paymentRoutes;
