import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ReportService } from '../services/report.service';

const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export class ReportController {
  /** GET /api/admin/reports/revenue/pdf?from=...&to=... */
  static async revenueReportPDF(request: FastifyRequest, reply: FastifyReply) {
    const parsed = dateRangeSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: 'from and to dates required (YYYY-MM-DD)', statusCode: 400 });
    }

    const { stream, filename } = await ReportService.revenueReportPDF(
      request.server.prisma,
      parsed.data.from,
      parsed.data.to,
    );

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(stream);
  }

  /** GET /api/admin/reports/bookings/pdf?from=...&to=... */
  static async bookingHistoryPDF(request: FastifyRequest, reply: FastifyReply) {
    const parsed = dateRangeSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: 'from and to dates required', statusCode: 400 });
    }
    const { stream, filename } = await ReportService.bookingHistoryPDF(
      request.server.prisma, parsed.data.from, parsed.data.to,
    );
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(stream);
  }

  /** GET /api/admin/reports/bookings/csv?from=...&to=... */
  static async bookingHistoryCSV(request: FastifyRequest, reply: FastifyReply) {
    const parsed = dateRangeSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: 'from and to dates required', statusCode: 400 });
    }
    const { csv, filename } = await ReportService.bookingHistoryCSV(
      request.server.prisma, parsed.data.from, parsed.data.to,
    );
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(csv);
  }

  /** GET /api/admin/reports/overview/pdf?from=...&to=... */
  static async overviewReportPDF(request: FastifyRequest, reply: FastifyReply) {
    const parsed = dateRangeSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: 'from and to dates required (YYYY-MM-DD)', statusCode: 400 });
    }
    const { stream, filename } = await ReportService.overviewReportPDF(
      request.server.prisma, parsed.data.from, parsed.data.to,
    );
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(stream);
  }

  /** GET /api/admin/reports/facilities/pdf?from=...&to=... */
  static async facilityUsagePDF(request: FastifyRequest, reply: FastifyReply) {
    const parsed = dateRangeSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: 'from and to dates required (YYYY-MM-DD)', statusCode: 400 });
    }
    const { stream, filename } = await ReportService.facilityUsagePDF(
      request.server.prisma, parsed.data.from, parsed.data.to,
    );
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(stream);
  }

  /** GET /api/admin/reports/facilities/csv?from=...&to=... */
  static async facilityUsageCSV(request: FastifyRequest, reply: FastifyReply) {
    const parsed = dateRangeSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: 'from and to dates required (YYYY-MM-DD)', statusCode: 400 });
    }
    const { csv, filename } = await ReportService.facilityUsageCSV(
      request.server.prisma, parsed.data.from, parsed.data.to,
    );
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(csv);
  }

  /** GET /api/admin/users/export */
  static async userExportCSV(request: FastifyRequest, reply: FastifyReply) {
    const { csv, filename } = await ReportService.userExportCSV(request.server.prisma);

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(csv);
  }
}
