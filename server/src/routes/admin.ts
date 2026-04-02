import { FastifyPluginAsync } from 'fastify';
import { authenticate, requireRole } from '../middleware/authenticate';

/** All admin routes require ADMIN role */
const adminGuard = [authenticate, requireRole('ADMIN')];

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/admin/dashboard
   * Returns summary stats: total bookings, revenue, active facilities
   */
  fastify.get('/dashboard', { preHandler: adminGuard }, async (request, reply) => {
    // TODO: AdminController.dashboard
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * GET /api/admin/bookings
   * List all bookings with filters
   * Query: ?status=CONFIRMED&date=YYYY-MM-DD&page=1&limit=20
   */
  fastify.get('/bookings', { preHandler: adminGuard }, async (request, reply) => {
    // TODO: AdminController.listBookings
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * PATCH /api/admin/bookings/:id/status
   * Update booking status manually
   */
  fastify.patch('/bookings/:id/status', { preHandler: adminGuard }, async (request, reply) => {
    // TODO: AdminController.updateBookingStatus
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * GET /api/admin/users
   * List all registered users
   */
  fastify.get('/users', { preHandler: adminGuard }, async (request, reply) => {
    // TODO: AdminController.listUsers
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * POST /api/admin/slots/bulk
   * Bulk-create slots for a facility over a date range
   * Body: { facilityId, startDate, endDate, timeSlots: [{startTime, endTime}] }
   */
  fastify.post('/slots/bulk', { preHandler: adminGuard }, async (request, reply) => {
    // TODO: AdminController.bulkCreateSlots
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });
};

export default adminRoutes;
