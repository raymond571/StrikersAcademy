import { FastifyPluginAsync } from 'fastify';
import { authenticate, requireAdmin, requireStaffOrAdmin } from '../middleware/authenticate';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/admin/dashboard
   * Returns summary stats: total bookings, revenue, active facilities
   * ADMIN + STAFF
   */
  fastify.get('/dashboard', { preHandler: [authenticate, requireStaffOrAdmin] }, async (request, reply) => {
    // TODO: AdminController.dashboard
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * GET /api/admin/bookings
   * List all bookings with filters
   * Query: ?status=CONFIRMED&date=YYYY-MM-DD&facilityId=&page=1&limit=20
   * ADMIN + STAFF
   */
  fastify.get('/bookings', { preHandler: [authenticate, requireStaffOrAdmin] }, async (request, reply) => {
    // TODO: AdminController.listBookings
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * POST /api/admin/bookings
   * Admin/staff creates a manual booking for any user
   * ADMIN + STAFF
   */
  fastify.post('/bookings', { preHandler: [authenticate, requireStaffOrAdmin] }, async (request, reply) => {
    // TODO: AdminController.createManualBooking
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * PATCH /api/admin/bookings/:id/status
   * Update booking status manually (approve/reject/refund)
   * ADMIN + STAFF
   */
  fastify.patch('/bookings/:id/status', { preHandler: [authenticate, requireStaffOrAdmin] }, async (request, reply) => {
    // TODO: AdminController.updateBookingStatus
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * GET /api/admin/users
   * List all registered users
   * ADMIN + STAFF
   */
  fastify.get('/users', { preHandler: [authenticate, requireStaffOrAdmin] }, async (request, reply) => {
    // TODO: AdminController.listUsers
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * POST /api/admin/slots/bulk
   * Bulk-create slots for a facility over a date range
   * Body: { facilityId, startDate, endDate, timeSlots: [{startTime, endTime}], capacity? }
   * ADMIN only
   */
  fastify.post('/slots/bulk', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    // TODO: AdminController.bulkCreateSlots
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * POST /api/admin/slots/block
   * Block slots for rain/holiday/maintenance
   * Body: { facilityId?, date, startTime?, endTime?, reason }
   * ADMIN + STAFF
   */
  fastify.post('/slots/block', { preHandler: [authenticate, requireStaffOrAdmin] }, async (request, reply) => {
    // TODO: AdminController.blockSlots
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * DELETE /api/admin/slots/block/:id
   * Remove a slot block
   * ADMIN + STAFF
   */
  fastify.delete('/slots/block/:id', { preHandler: [authenticate, requireStaffOrAdmin] }, async (request, reply) => {
    // TODO: AdminController.removeBlock
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * GET /api/admin/reports/revenue
   * Revenue report — daily/weekly breakdown
   * Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD
   * ADMIN only
   */
  fastify.get('/reports/revenue', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    // TODO: AdminController.revenueReport
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * GET /api/admin/coupons
   * List all coupons
   * ADMIN only
   */
  fastify.get('/coupons', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    // TODO: AdminController.listCoupons
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * POST /api/admin/coupons
   * Create a coupon
   * ADMIN only
   */
  fastify.post('/coupons', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    // TODO: AdminController.createCoupon
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });

  /**
   * PATCH /api/admin/coupons/:id
   * Update/deactivate a coupon
   * ADMIN only
   */
  fastify.patch('/coupons/:id', { preHandler: [authenticate, requireAdmin] }, async (request, reply) => {
    // TODO: AdminController.updateCoupon
    return reply.status(501).send({ success: false, error: 'Not implemented', statusCode: 501 });
  });
};

export default adminRoutes;
