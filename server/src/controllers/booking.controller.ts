/**
 * BookingController — handles slot reservation lifecycle.
 * Business logic lives in BookingService; this layer handles HTTP req/reply only.
 */
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { BookingService } from '../services/booking.service';
import { success, paginated } from '../utils/response';

// ── Validation schemas ────────────────────────────────────────

const createSchema = z.object({
  slotId: z.string().min(1, 'slotId is required'),
  bookingFor: z.enum(['SELF', 'CHILD', 'TEAM']).default('SELF'),
  playerName: z.string().max(100).optional(),
  teamName: z.string().max(100).optional(),
  paymentMethod: z.enum(['ONLINE', 'OFFLINE']).default('ONLINE'),
  notes: z.string().max(500).optional(),
});

const updateSlotSchema = z.object({
  slotId: z.string().min(1, 'slotId is required'),
  extraPaymentMethod: z.enum(['ONLINE', 'OFFLINE']).optional(),
});

const listQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => Math.max(1, parseInt(v || '1', 10))),
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(50, Math.max(1, parseInt(v || '10', 10)))),
});

// ── Controller ────────────────────────────────────────────────

export class BookingController {
  /**
   * POST /api/bookings
   * Body: { slotId, bookingFor?, playerName?, teamName?, paymentMethod?, notes? }
   */
  static async create(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = createSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        statusCode: 400,
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const booking = await BookingService.createBooking(request.server.prisma, {
      userId: request.user.id,
      ...parseResult.data,
    });

    reply.status(201);
    return success(
      {
        booking: {
          id: booking.id,
          status: booking.status,
          bookingFor: booking.bookingFor,
          playerName: booking.playerName,
          teamName: booking.teamName,
          paymentMethod: booking.paymentMethod,
          effectivePrice: booking.effectivePrice,
          slot: booking.slot,
          createdAt: booking.createdAt,
        },
      },
      'Booking created',
    );
  }

  /**
   * GET /api/bookings?page=1&limit=10
   * Returns current user's bookings with pagination
   */
  static async listMine(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = listQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        statusCode: 400,
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { page, limit } = parseResult.data;
    const { bookings, total } = await BookingService.listByUser(
      request.server.prisma,
      request.user.id,
      page,
      limit,
    );

    return paginated(bookings, page, limit, total);
  }

  /**
   * GET /api/bookings/:id
   * Returns a single booking (must belong to user or user is admin/staff)
   */
  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const booking = await BookingService.getById(
      request.server.prisma,
      id,
      request.user.id,
      request.user.role,
    );
    return success({ booking });
  }

  /**
   * PATCH /api/bookings/:id/cancel
   * Cancel a booking (must belong to user or user is admin/staff)
   */
  static async cancel(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const booking = await BookingService.cancelBooking(
      request.server.prisma,
      id,
      request.user.id,
      request.user.role,
    );
    return success({ booking }, 'Booking cancelled');
  }

  /**
   * PATCH /api/bookings/:id/update-slot
   * Reschedule a booking to a different slot
   */
  static async updateSlot(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parseResult = updateSlotSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        statusCode: 400,
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const result = await BookingService.updateSlot(
      request.server.prisma,
      id,
      parseResult.data.slotId,
      request.user.id,
      request.user.role,
      parseResult.data.extraPaymentMethod,
    );

    return success({ booking: result }, 'Booking updated');
  }
}
