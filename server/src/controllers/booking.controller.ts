/**
 * BookingController — handles slot reservation lifecycle.
 */
import { FastifyReply, FastifyRequest } from 'fastify';

export class BookingController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    // TODO: validate slotId, check slot availability, create booking (PENDING),
    //       call PaymentService.createOrder, return order details
    throw new Error('Not implemented');
  }

  static async listMine(request: FastifyRequest, reply: FastifyReply) {
    // TODO: fetch paginated bookings for request.user.id, include slot + facility
    throw new Error('Not implemented');
  }

  static async getById(request: FastifyRequest, reply: FastifyReply) {
    // TODO: fetch booking, ensure it belongs to current user (or user is ADMIN)
    throw new Error('Not implemented');
  }

  static async cancel(request: FastifyRequest, reply: FastifyReply) {
    // TODO: validate cancellation window, set status CANCELLED, free slot
    throw new Error('Not implemented');
  }
}
