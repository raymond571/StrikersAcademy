/**
 * AdminController — HTTP layer for admin panel endpoints.
 * Business logic lives in AdminService; this layer handles HTTP req/reply only.
 */
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AdminService } from '../services/admin.service';
import { success, paginated } from '../utils/response';

// ── Validation schemas ────────────────────────────────────────

const paginationSchema = z.object({
  page: z.string().optional().transform((v) => Math.max(1, parseInt(v || '1', 10))),
  limit: z.string().optional().transform((v) => Math.min(50, Math.max(1, parseInt(v || '20', 10)))),
});

const listBookingsSchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'WAITLISTED', 'REFUNDED']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  facilityId: z.string().optional(),
});

const manualBookingSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  slotId: z.string().min(1, 'slotId is required'),
  bookingFor: z.enum(['SELF', 'CHILD', 'TEAM']).default('SELF'),
  playerName: z.string().max(100).optional(),
  teamName: z.string().max(100).optional(),
  paymentMethod: z.enum(['ONLINE', 'OFFLINE']).default('OFFLINE'),
  notes: z.string().max(500).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED']),
  notes: z.string().max(500).optional(),
});

const bulkSlotsSchema = z.object({
  facilityId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeSlots: z.array(z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })).min(1, 'At least one time slot is required'),
  capacity: z.number().int().min(1).optional(),
});

const blockSlotsSchema = z.object({
  facilityId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().min(1).max(200),
});

const revenueQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const createCouponSchema = z.object({
  code: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  discountType: z.enum(['FIXED', 'PERCENT']),
  discountValue: z.number().int().min(1),
  maxUsage: z.number().int().min(1).optional(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const updateCouponSchema = z.object({
  description: z.string().max(200).optional(),
  discountValue: z.number().int().min(1).optional(),
  maxUsage: z.number().int().min(1).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  isActive: z.boolean().optional(),
});

// ── Helper ───────────────────────────────────────────────────

function validationError(reply: FastifyReply, error: z.ZodError) {
  return reply.status(400).send({
    success: false,
    error: 'Validation failed',
    statusCode: 400,
    details: error.flatten().fieldErrors,
  });
}

// ── Controller ───────────────────────────────────────────────

export class AdminController {
  /** GET /api/admin/dashboard */
  static async dashboard(request: FastifyRequest, reply: FastifyReply) {
    const stats = await AdminService.dashboard(request.server.prisma);
    return success({ stats });
  }

  /** GET /api/admin/bookings */
  static async listBookings(request: FastifyRequest, reply: FastifyReply) {
    const parsed = listBookingsSchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);

    const { page, limit, ...filters } = parsed.data;
    const { bookings, total } = await AdminService.listBookings(request.server.prisma, {
      ...filters,
      page,
      limit,
    });
    return paginated(bookings, page, limit, total);
  }

  /** POST /api/admin/bookings */
  static async createManualBooking(request: FastifyRequest, reply: FastifyReply) {
    const parsed = manualBookingSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const booking = await AdminService.createManualBooking(request.server.prisma, {
      ...parsed.data,
      createdById: request.user.id,
    });
    reply.status(201);
    return success({ booking }, 'Manual booking created');
  }

  /** PATCH /api/admin/bookings/:id/status */
  static async updateBookingStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parsed = updateStatusSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const booking = await AdminService.updateBookingStatus(
      request.server.prisma,
      id,
      parsed.data.status,
      parsed.data.notes,
    );
    return success({ booking }, 'Booking status updated');
  }

  /** GET /api/admin/users */
  static async listUsers(request: FastifyRequest, reply: FastifyReply) {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);

    const { page, limit } = parsed.data;
    const { users, total } = await AdminService.listUsers(request.server.prisma, page, limit);
    return paginated(users, page, limit, total);
  }

  /** POST /api/admin/users */
  static async createUser(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
      name: z.string().min(2).max(100),
      email: z.string().email().max(255),
      phone: z.string().regex(/^[6-9]\d{9}$/),
      age: z.number().int().min(5).max(120),
      password: z.string().min(6).max(128),
      role: z.enum(['ADMIN', 'STAFF', 'CUSTOMER']).default('CUSTOMER'),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const user = await AdminService.createUser(request.server.prisma, parsed.data);
    reply.status(201);
    return success({ user }, 'User created');
  }

  /** PATCH /api/admin/users/:id */
  static async updateUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string().min(2).max(100).optional(),
      email: z.string().email().max(255).optional(),
      age: z.number().int().min(5).max(120).optional(),
      role: z.enum(['ADMIN', 'STAFF', 'CUSTOMER']).optional(),
      password: z.string().min(6).max(128).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const user = await AdminService.updateUser(request.server.prisma, id, parsed.data);
    return success({ user }, 'User updated');
  }

  /** DELETE /api/admin/users/:id */
  static async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await AdminService.deleteUser(request.server.prisma, id);
    return success({ ...result }, 'User deleted');
  }

  /** POST /api/admin/slots/bulk */
  static async bulkCreateSlots(request: FastifyRequest, reply: FastifyReply) {
    const parsed = bulkSlotsSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const result = await AdminService.bulkCreateSlots(request.server.prisma, parsed.data);
    reply.status(201);
    return success({ ...result }, `Created ${result.created} slots (${result.skipped} skipped as duplicates)`);
  }

  /** POST /api/admin/slots/block */
  static async blockSlots(request: FastifyRequest, reply: FastifyReply) {
    const parsed = blockSlotsSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const block = await AdminService.blockSlots(request.server.prisma, {
      ...parsed.data,
      createdById: request.user.id,
    });
    reply.status(201);
    return success({ block }, 'Slots blocked');
  }

  /** DELETE /api/admin/slots/block/:id */
  static async removeBlock(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const block = await AdminService.removeBlock(request.server.prisma, id);
    return success({ block }, 'Block removed');
  }

  /** GET /api/admin/reports/revenue */
  static async revenueReport(request: FastifyRequest, reply: FastifyReply) {
    const parsed = revenueQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, parsed.error);

    const report = await AdminService.revenueReport(request.server.prisma, parsed.data);
    return success({ report });
  }

  /** GET /api/admin/coupons */
  static async listCoupons(request: FastifyRequest, reply: FastifyReply) {
    const coupons = await AdminService.listCoupons(request.server.prisma);
    return success({ coupons });
  }

  /** POST /api/admin/coupons */
  static async createCoupon(request: FastifyRequest, reply: FastifyReply) {
    const parsed = createCouponSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const coupon = await AdminService.createCoupon(request.server.prisma, parsed.data);
    reply.status(201);
    return success({ coupon }, 'Coupon created');
  }

  /** PATCH /api/admin/coupons/:id */
  static async updateCoupon(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parsed = updateCouponSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const coupon = await AdminService.updateCoupon(request.server.prisma, id, parsed.data);
    return success({ coupon }, 'Coupon updated');
  }

  /** GET /api/admin/payments/:id/verify — cross-check with Razorpay */
  static async verifyPayment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await AdminService.razorpayVerify(request.server.prisma, id);
    return success({ ...result });
  }

  // ── Facility Types ─────────────────────────────────────────

  /** GET /api/admin/facility-types */
  static async listFacilityTypes(request: FastifyRequest, reply: FastifyReply) {
    const types = await AdminService.listFacilityTypes(request.server.prisma);
    return success({ types });
  }

  /** POST /api/admin/facility-types */
  static async createFacilityType(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({
      name: z.string().min(1).max(50),
      label: z.string().min(1).max(100),
      description: z.string().max(300).optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const type = await AdminService.createFacilityType(request.server.prisma, parsed.data);
    reply.status(201);
    return success({ type }, 'Facility type created');
  }

  /** PATCH /api/admin/facility-types/:id */
  static async updateFacilityType(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const schema = z.object({
      label: z.string().min(1).max(100).optional(),
      description: z.string().max(300).optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error);

    const type = await AdminService.updateFacilityType(request.server.prisma, id, parsed.data);
    return success({ type }, 'Facility type updated');
  }

  /** DELETE /api/admin/facility-types/:id */
  static async deleteFacilityType(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const type = await AdminService.deleteFacilityType(request.server.prisma, id);
    return success({ type }, 'Facility type deleted');
  }
}
