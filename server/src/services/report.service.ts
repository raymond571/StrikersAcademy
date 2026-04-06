/**
 * ReportService — PDF revenue reports and CSV user data exports.
 */
import PDFDocument from 'pdfkit';
import { PrismaClient } from '@prisma/client';
import { SettingsService } from './settings.service';
import { AdminService } from './admin.service';

function formatPaise(paise: number): string {
  return `Rs. ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export const ReportService = {
  /** Generate a PDF revenue report for a date range */
  async revenueReportPDF(prisma: PrismaClient, from: string, to: string): Promise<{ stream: PDFKit.PDFDocument; filename: string }> {
    const report = await AdminService.revenueReport(prisma, { from, to });
    const settings = await SettingsService.getMany(prisma, ['academy_name', 'academy_address']);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const filename = `revenue-report-${from}-to-${to}.pdf`;

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text(settings.academy_name || 'StrikersAcademy', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(settings.academy_address || '', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text('Revenue Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`${from} to ${to}`, { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Summary
    doc.fontSize(11).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');

    const summaryData = [
      ['Gross Revenue', formatPaise(report.totalRevenue)],
      ['Online Payments', formatPaise(report.totalOnline)],
      ['Offline Payments', formatPaise(report.totalOffline)],
      ['Total Refunds', formatPaise(report.totalRefunds)],
      ['Net Revenue', formatPaise(report.netRevenue)],
      ['Total Transactions', String(report.totalPayments)],
      ['Refund Count', String(report.totalRefundCount)],
    ];

    for (const [label, value] of summaryData) {
      doc.text(`${label}:`, 60, doc.y, { continued: true, width: 200 });
      doc.text(value, { align: 'right', width: 200 });
    }

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Daily breakdown
    if (report.daily.length > 0) {
      doc.fontSize(11).font('Helvetica-Bold').text('Daily Breakdown');
      doc.moveDown(0.5);

      const cols = [50, 130, 210, 290, 370, 440, 500];
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('Date', cols[0], doc.y);
      doc.text('Revenue', cols[1], doc.y);
      doc.text('Online', cols[2], doc.y);
      doc.text('Offline', cols[3], doc.y);
      doc.text('Refunds', cols[4], doc.y);
      doc.text('Net', cols[5], doc.y);
      doc.text('Txns', cols[6], doc.y);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

      doc.fontSize(8).font('Helvetica');
      for (const d of report.daily) {
        const y = doc.y + 5;
        if (y > 750) { doc.addPage(); }
        doc.text(d.date, cols[0], doc.y + 5);
        doc.text(formatPaise(d.revenue), cols[1], doc.y);
        doc.text(formatPaise(d.online), cols[2], doc.y);
        doc.text(formatPaise(d.offline), cols[3], doc.y);
        doc.text(formatPaise(d.refunds), cols[4], doc.y);
        doc.text(formatPaise(d.revenue - d.refunds), cols[5], doc.y);
        doc.text(String(d.count), cols[6], doc.y);
        doc.moveDown(0.3);
      }
    }

    // Footer
    doc.fontSize(8).font('Helvetica')
      .text(`Generated on ${new Date().toLocaleString('en-IN')}`, 50, 770, { align: 'center' });

    doc.end();
    return { stream: doc, filename };
  },

  /** Generate a CSV export of all users for marketing */
  async userExportCSV(prisma: PrismaClient): Promise<{ csv: string; filename: string }> {
    const users = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        email: true,
        phone: true,
        age: true,
        dateOfBirth: true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
    });

    const header = 'Name,Email,Phone,Age,Date of Birth,Registered,Total Bookings';
    const rows = users.map((u: any) =>
      `"${u.name}","${u.email}","${u.phone}",${u.age},"${u.dateOfBirth || ''}","${u.createdAt.toISOString().split('T')[0]}",${u._count.bookings}`
    );

    const csv = [header, ...rows].join('\n');
    const filename = `users-export-${new Date().toISOString().split('T')[0]}.csv`;

    return { csv, filename };
  },
};
