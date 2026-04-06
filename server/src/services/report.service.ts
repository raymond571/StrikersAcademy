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

  /** Generate booking history CSV */
  async bookingHistoryCSV(prisma: PrismaClient, from: string, to: string): Promise<{ csv: string; filename: string }> {
    const bookings = await prisma.booking.findMany({
      where: {
        slot: { date: { gte: from, lte: to } },
      },
      include: {
        user: { select: { name: true, phone: true, email: true } },
        slot: { include: { facility: true } },
        payment: true,
      },
      orderBy: [{ slot: { date: 'asc' } }, { slot: { startTime: 'asc' } }],
    });

    const header = 'Booking ID,Customer,Phone,Email,Facility,Date,Time,Status,Payment Method,Payment Status,Amount,Razorpay ID,Cancellation Charge,Refund Amount,Booked At';
    const rows = bookings.map((b: any) =>
      [
        b.id,
        `"${b.user?.name || ''}"`,
        b.user?.phone || '',
        b.user?.email || '',
        `"${b.slot?.facility?.name || ''}"`,
        b.slot?.date || '',
        `${b.slot?.startTime || ''}-${b.slot?.endTime || ''}`,
        b.status,
        b.paymentMethod,
        b.payment?.status || '',
        b.payment ? (b.payment.amount / 100).toFixed(2) : '',
        b.payment?.razorpayPaymentId || '',
        b.payment?.cancellationCharge ? (b.payment.cancellationCharge / 100).toFixed(2) : '',
        b.payment?.refundAmount ? (b.payment.refundAmount / 100).toFixed(2) : '',
        b.createdAt.toISOString().split('T')[0],
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');
    return { csv, filename: `bookings-${from}-to-${to}.csv` };
  },

  /** Generate booking history PDF */
  async bookingHistoryPDF(prisma: PrismaClient, from: string, to: string): Promise<{ stream: PDFKit.PDFDocument; filename: string }> {
    const bookings = await prisma.booking.findMany({
      where: {
        slot: { date: { gte: from, lte: to } },
      },
      include: {
        user: { select: { name: true, phone: true } },
        slot: { include: { facility: true } },
        payment: true,
      },
      orderBy: [{ slot: { date: 'asc' } }, { slot: { startTime: 'asc' } }],
    });

    const settings = await SettingsService.getMany(prisma, ['academy_name', 'academy_address']);
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
    const filename = `bookings-${from}-to-${to}.pdf`;

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text(settings.academy_name || 'StrikersAcademy', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Booking History: ${from} to ${to}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.text(`Total: ${bookings.length} bookings | Generated: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });
    doc.moveDown();
    doc.moveTo(40, doc.y).lineTo(802, doc.y).stroke();
    doc.moveDown(0.5);

    // Table header
    const cols = [40, 130, 230, 310, 380, 430, 500, 560, 640, 720];
    doc.fontSize(7).font('Helvetica-Bold');
    doc.text('Customer', cols[0], doc.y);
    doc.text('Phone', cols[1], doc.y);
    doc.text('Facility', cols[2], doc.y);
    doc.text('Date', cols[3], doc.y);
    doc.text('Time', cols[4], doc.y);
    doc.text('Status', cols[5], doc.y);
    doc.text('Payment', cols[6], doc.y);
    doc.text('Pay Status', cols[7], doc.y);
    doc.text('Amount', cols[8], doc.y);
    doc.text('Razorpay ID', cols[9], doc.y);
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(802, doc.y).stroke();

    // Rows
    doc.fontSize(7).font('Helvetica');
    for (const b of bookings as any[]) {
      if (doc.y > 540) { doc.addPage(); }
      const y = doc.y + 4;
      doc.text((b.user?.name || '').slice(0, 15), cols[0], y, { width: 85 });
      doc.text(b.user?.phone || '', cols[1], y, { width: 95 });
      doc.text((b.slot?.facility?.name || '').slice(0, 12), cols[2], y, { width: 75 });
      doc.text(b.slot?.date || '', cols[3], y, { width: 65 });
      doc.text(`${b.slot?.startTime || ''}-${b.slot?.endTime || ''}`, cols[4], y, { width: 65 });
      doc.text(b.status, cols[5], y, { width: 55 });
      doc.text(b.paymentMethod, cols[6], y, { width: 55 });
      doc.text(b.payment?.status || '', cols[7], y, { width: 55 });
      doc.text(b.payment ? formatPaise(b.payment.amount) : '', cols[8], y, { width: 75 });
      doc.text((b.payment?.razorpayPaymentId || '').slice(0, 18), cols[9], y, { width: 82 });
      doc.moveDown(0.3);
    }

    // Summary
    doc.moveDown();
    doc.moveTo(40, doc.y).lineTo(802, doc.y).stroke();
    doc.moveDown(0.5);
    const total = bookings.reduce((s: number, b: any) => s + (b.payment?.amount || 0), 0);
    const confirmed = bookings.filter((b: any) => b.status === 'CONFIRMED').length;
    const cancelled = bookings.filter((b: any) => b.status === 'CANCELLED' || b.status === 'REFUNDED').length;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text(`Total: ${bookings.length} bookings | Confirmed: ${confirmed} | Cancelled/Refunded: ${cancelled} | Total Amount: ${formatPaise(total)}`, 40);

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
