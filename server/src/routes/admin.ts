import { FastifyPluginAsync } from 'fastify';
import { authenticate, requireAdmin, requireStaffOrAdmin } from '../middleware/authenticate';
import { AdminController } from '../controllers/admin.controller';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // ── ADMIN + STAFF ────────────────────────────────────────────
  fastify.get('/dashboard', { preHandler: [authenticate, requireStaffOrAdmin] }, AdminController.dashboard);
  fastify.get('/bookings', { preHandler: [authenticate, requireStaffOrAdmin] }, AdminController.listBookings);
  fastify.post('/bookings', { preHandler: [authenticate, requireStaffOrAdmin] }, AdminController.createManualBooking);
  fastify.patch('/bookings/:id/status', { preHandler: [authenticate, requireStaffOrAdmin] }, AdminController.updateBookingStatus);
  fastify.get('/users', { preHandler: [authenticate, requireStaffOrAdmin] }, AdminController.listUsers);
  fastify.post('/users', { preHandler: [authenticate, requireAdmin] }, AdminController.createUser);
  fastify.patch('/users/:id', { preHandler: [authenticate, requireAdmin] }, AdminController.updateUser);
  fastify.delete('/users/:id', { preHandler: [authenticate, requireAdmin] }, AdminController.deleteUser);
  fastify.post('/slots/block', { preHandler: [authenticate, requireStaffOrAdmin] }, AdminController.blockSlots);
  fastify.delete('/slots/block/:id', { preHandler: [authenticate, requireStaffOrAdmin] }, AdminController.removeBlock);

  // ── ADMIN only ───────────────────────────────────────────────
  fastify.post('/slots/bulk', { preHandler: [authenticate, requireAdmin] }, AdminController.bulkCreateSlots);
  fastify.get('/reports/revenue', { preHandler: [authenticate, requireAdmin] }, AdminController.revenueReport);
  fastify.get('/payments/:id/verify', { preHandler: [authenticate, requireAdmin] }, AdminController.verifyPayment);
  fastify.get('/coupons', { preHandler: [authenticate, requireAdmin] }, AdminController.listCoupons);
  fastify.post('/coupons', { preHandler: [authenticate, requireAdmin] }, AdminController.createCoupon);
  fastify.patch('/coupons/:id', { preHandler: [authenticate, requireAdmin] }, AdminController.updateCoupon);

  // ── Facility Types (ADMIN only) ──────────────────────────────
  fastify.get('/facility-types', { preHandler: [authenticate, requireStaffOrAdmin] }, AdminController.listFacilityTypes);
  fastify.post('/facility-types', { preHandler: [authenticate, requireAdmin] }, AdminController.createFacilityType);
  fastify.patch('/facility-types/:id', { preHandler: [authenticate, requireAdmin] }, AdminController.updateFacilityType);
  fastify.delete('/facility-types/:id', { preHandler: [authenticate, requireAdmin] }, AdminController.deleteFacilityType);
};

export default adminRoutes;
