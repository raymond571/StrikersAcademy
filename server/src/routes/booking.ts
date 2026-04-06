import { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../middleware/authenticate';
import { BookingController } from '../controllers/booking.controller';

const bookingRoutes: FastifyPluginAsync = async (fastify) => {
  /** POST /api/bookings — create a single booking (auth required) */
  fastify.post('/', { preHandler: [authenticate] }, BookingController.create);

  /** POST /api/bookings/batch — create multiple bookings at once (auth required) */
  fastify.post('/batch', { preHandler: [authenticate] }, BookingController.createBatch);

  /** GET /api/bookings — list current user's bookings (auth required) */
  fastify.get('/', { preHandler: [authenticate] }, BookingController.listMine);

  /** GET /api/bookings/:id — get a specific booking (auth required) */
  fastify.get('/:id', { preHandler: [authenticate] }, BookingController.getById);

  /** PATCH /api/bookings/:id/cancel — cancel a booking (auth required) */
  fastify.patch('/:id/cancel', { preHandler: [authenticate] }, BookingController.cancel);

  /** PATCH /api/bookings/:id/update-slot — reschedule to a different slot (auth required) */
  fastify.patch('/:id/update-slot', { preHandler: [authenticate] }, BookingController.updateSlot);
};

export default bookingRoutes;
