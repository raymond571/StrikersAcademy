/**
 * FacilityController — HTTP layer for facility and slot endpoints.
 */
import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { FacilityService } from '../services/facility.service';
import { success } from '../utils/response';

// ── Validation schemas ────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(['NET', 'TURF']),
  description: z.string().max(500).optional(),
  pricePerSlot: z.number().int().min(0, 'Price must be non-negative'),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['NET', 'TURF']).optional(),
  description: z.string().max(500).optional(),
  pricePerSlot: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const slotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  availableOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

// ── Controller ────────────────────────────────────────────────

export class FacilityController {
  /** GET /api/facilities — list active facilities */
  static async list(request: FastifyRequest, reply: FastifyReply) {
    const facilities = await FacilityService.listActive(request.server.prisma);
    return success({ facilities });
  }

  /** GET /api/facilities/:id — get facility by id */
  static async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const facility = await FacilityService.getById(request.server.prisma, id);
    return success({ facility });
  }

  /** GET /api/facilities/:id/slots?date=YYYY-MM-DD&availableOnly=true */
  static async getSlots(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parseResult = slotsQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        statusCode: 400,
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { date, availableOnly } = parseResult.data;
    const slots = await FacilityService.getSlots(
      request.server.prisma,
      id,
      date,
      availableOnly ?? false,
    );
    return success({ slots });
  }

  /** POST /api/facilities — admin create facility */
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

    const facility = await FacilityService.create(
      request.server.prisma,
      parseResult.data,
    );
    reply.status(201);
    return success({ facility }, 'Facility created');
  }

  /** PATCH /api/facilities/:id — admin update facility */
  static async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const parseResult = updateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Validation failed',
        statusCode: 400,
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const facility = await FacilityService.update(
      request.server.prisma,
      id,
      parseResult.data,
    );
    return success({ facility }, 'Facility updated');
  }
}
