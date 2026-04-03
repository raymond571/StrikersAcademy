import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import { PaymentController } from '../controllers/payment.controller';

const paymentRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/payments/initiate
   * Auth required — create a Razorpay order for a booking
   * Body: { bookingId }
   */
  fastify.post('/initiate', { preHandler: [authenticate] }, PaymentController.initiate);

  /**
   * POST /api/payments/verify
   * Auth required — verify Razorpay payment signature after checkout
   * Body: { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId }
   */
  fastify.post('/verify', { preHandler: [authenticate] }, PaymentController.verify);

  /**
   * POST /api/payments/webhook
   * Public — Razorpay webhook endpoint (verified via signature header)
   * Register this URL in Razorpay dashboard
   */
  fastify.post('/webhook', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, PaymentController.webhook);
};

export default paymentRoutes;
