import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/authenticate';

const bookingRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/bookings
   * Auth required — create a booking for a slot
   * Body: { slotId }
   * Returns booking + initiates Razorpay order
   */
  fastify.post('/', { preHandler: [authenticate] }, async (request, reply) => {
    // TODO: BookingController.create
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * GET /api/bookings
   * Auth required — list current user's bookings
   */
  fastify.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    // TODO: BookingController.listMine
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * GET /api/bookings/:id
   * Auth required — get a specific booking (must belong to user)
   */
  fastify.get('/:id', { preHandler: [authenticate] }, async (request, reply) => {
    // TODO: BookingController.getById
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * PATCH /api/bookings/:id/cancel
   * Auth required — cancel a booking
   */
  fastify.patch('/:id/cancel', { preHandler: [authenticate] }, async (request, reply) => {
    // TODO: BookingController.cancel
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });
};

export default bookingRoutes;
