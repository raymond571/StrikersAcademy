import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import { BookingController } from '../controllers/booking.controller';

const bookingRoutes: FastifyPluginAsync = async (fastify) => {
  /** POST /api/bookings — create a booking (auth required) */
  fastify.post('/', { preHandler: [authenticate] }, BookingController.create);

  /** GET /api/bookings — list current user's bookings (auth required) */
  fastify.get('/', { preHandler: [authenticate] }, BookingController.listMine);

  /** GET /api/bookings/:id — get a specific booking (auth required) */
  fastify.get('/:id', { preHandler: [authenticate] }, BookingController.getById);

  /** PATCH /api/bookings/:id/cancel — cancel a booking (auth required) */
  fastify.patch('/:id/cancel', { preHandler: [authenticate] }, BookingController.cancel);
};

export default bookingRoutes;
