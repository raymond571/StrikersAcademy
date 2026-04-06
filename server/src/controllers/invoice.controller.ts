import { FastifyReply, FastifyRequest } from 'fastify';
import { InvoiceService } from '../services/invoice.service';

export class InvoiceController {
  static async download(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const { stream, filename } = await InvoiceService.generateInvoice(
      request.server.prisma,
      id,
      request.user.id,
      request.user.role,
    );

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(stream);
  }
}
