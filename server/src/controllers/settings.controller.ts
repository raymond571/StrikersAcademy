import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { SettingsService } from '../services/settings.service';
import { success } from '../utils/response';

const updateSchema = z.record(z.string(), z.string());

export class SettingsController {
  static async getAll(request: FastifyRequest, reply: FastifyReply) {
    const settings = await SettingsService.getAll(request.server.prisma);
    return success({ settings });
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    const parseResult = updateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ success: false, error: 'Invalid settings data', statusCode: 400 });
    }
    await SettingsService.setMany(request.server.prisma, parseResult.data);
    const settings = await SettingsService.getAll(request.server.prisma);
    return success({ settings }, 'Settings updated');
  }

  /** Public endpoint — returns cancellation charge info for a booking */
  static async getCancellationPreview(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const prisma = request.server.prisma;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { payment: true, slot: { include: { facility: true } } },
    });

    if (!booking) return reply.status(404).send({ success: false, error: 'Booking not found', statusCode: 404 });
    if (booking.userId !== request.user.id && request.user.role !== 'ADMIN' && request.user.role !== 'STAFF') {
      return reply.status(403).send({ success: false, error: 'Access denied', statusCode: 403 });
    }

    const chargePercent = await SettingsService.getCancellationChargePercent(prisma);
    const amount = booking.payment?.amount ?? 0;
    const charge = Math.round(amount * chargePercent / 100);
    const refund = amount - charge;

    return success({
      bookingId: booking.id,
      amount,
      chargePercent,
      cancellationCharge: charge,
      refundAmount: refund,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.payment?.status,
    });
  }
}
