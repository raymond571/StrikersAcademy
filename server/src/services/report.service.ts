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
  /** Generate a visual PDF revenue report with colored cards */
  async revenueReportPDF(prisma: PrismaClient, from: string, to: string): Promise<{ stream: PDFKit.PDFDocument; filename: string }> {
    const report = await AdminService.revenueReport(prisma, { from, to });
    const settings = await SettingsService.getMany(prisma, ['academy_name', 'academy_address']);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const filename = `revenue-report-${from}-to-${to}.pdf`;

    // Helper to draw a colored card
    const drawCard = (x: number, y: number, w: number, h: number, bgColor: string, label: string, value: string, border?: string) => {
      doc.save();
      if (border) {
        doc.roundedRect(x, y, w, h, 6).lineWidth(2).strokeColor(border).stroke();
        doc.fillColor('#000000').fontSize(9).font('Helvetica').text(label, x + 10, y + 8, { width: w - 20 });
        doc.fillColor('#000000').fontSize(18).font('Helvetica-Bold').text(value, x + 10, y + 26, { width: w - 20 });
      } else {
        doc.roundedRect(x, y, w, h, 6).fill(bgColor);
        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica').text(label, x + 10, y + 8, { width: w - 20 });
        doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold').text(value, x + 10, y + 26, { width: w - 20 });
      }
      doc.restore();
      doc.fillColor('#000000');
    };

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text(settings.academy_name || 'StrikersAcademy', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(settings.academy_address || '', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text('Revenue Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`${from} to ${to}`, { align: 'center' });
    doc.moveDown(1.5);

    // Row 1: Gross, Refunds, Net
    const cw = 155;
    const ch = 55;
    const gap = 12;
    let sy = doc.y;

    drawCard(50, sy, cw, ch, '#6B7280', 'Gross Revenue', formatPaise(report.totalRevenue));
    drawCard(50 + cw + gap, sy, cw, ch, '#EF4444', 'Refunds (' + report.totalRefundCount + ')', '-' + formatPaise(report.totalRefunds));
    drawCard(50 + 2 * (cw + gap), sy, cw, ch, '', 'Net Revenue', formatPaise(report.netRevenue), '#10B981');

    sy += ch + gap;

    // Row 2: Online, Offline, Transactions
    drawCard(50, sy, cw, ch, '#10B981', 'Online Payments', formatPaise(report.totalOnline));
    drawCard(50 + cw + gap, sy, cw, ch, '#3B82F6', 'Offline Payments', formatPaise(report.totalOffline));
    drawCard(50 + 2 * (cw + gap), sy, cw, ch, '#6B7280', 'Transactions', String(report.totalPayments));

    doc.y = sy + ch + gap * 2;

    // Daily breakdown table
    if (report.daily.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Daily Breakdown');
      doc.moveDown(0.5);

      // Table header with background
      const tableY = doc.y;
      doc.save();
      doc.rect(50, tableY, 495, 18).fill('#F3F4F6');
      doc.restore();

      const cols = [55, 135, 215, 290, 365, 435, 500];
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#374151');
      doc.text('Date', cols[0], tableY + 4);
      doc.text('Revenue', cols[1], tableY + 4);
      doc.text('Online', cols[2], tableY + 4);
      doc.text('Offline', cols[3], tableY + 4);
      doc.text('Refunds', cols[4], tableY + 4);
      doc.text('Net', cols[5], tableY + 4);
      doc.text('Txns', cols[6], tableY + 4);

      doc.y = tableY + 22;

      doc.fontSize(8).font('Helvetica').fillColor('#000000');
      let rowIdx = 0;
      for (const d of report.daily) {
        if (doc.y > 740) { doc.addPage(); }
        const ry = doc.y;

        // Alternating row background
        if (rowIdx % 2 === 1) {
          doc.save();
          doc.rect(50, ry - 2, 495, 16).fill('#F9FAFB');
          doc.restore();
          doc.fillColor('#000000');
        }

        doc.text(d.date, cols[0], ry);
        doc.text(formatPaise(d.revenue), cols[1], ry);
        doc.fillColor('#10B981').text(formatPaise(d.online), cols[2], ry);
        doc.fillColor('#3B82F6').text(formatPaise(d.offline), cols[3], ry);
        doc.fillColor('#EF4444').text(d.refunds > 0 ? '-' + formatPaise(d.refunds) : '—', cols[4], ry);
        doc.fillColor('#10B981').font('Helvetica-Bold').text(formatPaise(d.revenue - d.refunds), cols[5], ry);
        doc.fillColor('#000000').font('Helvetica').text(String(d.count), cols[6], ry);
        doc.moveDown(0.3);
        rowIdx++;
      }
    }

    // Footer
    doc.fontSize(8).font('Helvetica').fillColor('#9CA3AF')
      .text(`Generated on ${new Date().toLocaleString('en-IN')}`, 50, 770, { align: 'center' });

    doc.end();
    return { stream: doc, filename };
  },

  /** Generate booking history CSV */
  async bookingHistoryCSV(prisma: PrismaClient, from: string, to: string): Promise<{ csv: string; filename: string }> {
    const bookings = await prisma.booking.findMany({
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

  /** Generate a visual overview PDF with colored stat cards */
  async overviewReportPDF(prisma: PrismaClient, from: string, to: string): Promise<{ stream: PDFKit.PDFDocument; filename: string }> {
    const stats = await AdminService.dashboard(prisma);
    const settings = await SettingsService.getMany(prisma, ['academy_name', 'academy_address']);

    // Fetch bookings in range for status/payment breakdowns
    const bookings = await prisma.booking.findMany({
      where: { slot: { date: { gte: from, lte: to } } },
      include: { payment: true },
    });

    const statusCounts: Record<string, number> = {};
    let onlineCount = 0;
    let offlineCount = 0;
    for (const b of bookings) {
      statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
      if (b.paymentMethod === 'ONLINE') onlineCount++;
      else offlineCount++;
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const filename = `overview-report-${from}-to-${to}.pdf`;

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text(settings.academy_name || 'StrikersAcademy', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(settings.academy_address || '', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text('Overview Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`${from} to ${to}`, { align: 'center' });
    doc.moveDown(1.5);

    // Helper to draw a colored card
    const drawCard = (x: number, y: number, w: number, h: number, color: string, label: string, value: string) => {
      doc.save();
      doc.roundedRect(x, y, w, h, 6).fill(color);
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica').text(label, x + 10, y + 10, { width: w - 20 });
      doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text(value, x + 10, y + 30, { width: w - 20 });
      doc.restore();
      doc.fillColor('#000000'); // reset
    };

    // Row 1: Key stats
    const cardW = 155;
    const cardH = 60;
    const gap = 12;
    let startY = doc.y;

    drawCard(50, startY, cardW, cardH, '#6B7280', 'Total Bookings', String(stats.totalBookings));
    drawCard(50 + cardW + gap, startY, cardW, cardH, '#10B981', 'All-Time Revenue', formatPaise(stats.totalRevenue));
    drawCard(50 + 2 * (cardW + gap), startY, cardW, cardH, '#6366F1', 'Customers', String(stats.totalUsers));

    startY += cardH + gap;
    drawCard(50, startY, cardW, cardH, '#8B5CF6', 'Active Facilities', String(stats.activeFacilities));
    drawCard(50 + cardW + gap, startY, cardW, cardH, '#3B82F6', "Today's Bookings", String(stats.todayBookings));

    doc.y = startY + cardH + gap * 2;

    // Section: Booking Status Breakdown
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Booking Status Breakdown (period)');
    doc.moveDown(0.5);
    startY = doc.y;

    const statusCards: [string, string, string][] = [
      ['PENDING', String(statusCounts['PENDING'] || 0), '#F59E0B'],
      ['CONFIRMED', String(statusCounts['CONFIRMED'] || 0), '#10B981'],
      ['CANCELLED', String(statusCounts['CANCELLED'] || 0), '#EF4444'],
      ['REFUNDED', String(statusCounts['REFUNDED'] || 0), '#EF4444'],
    ];

    const smallW = 118;
    const smallH = 50;
    statusCards.forEach(([label, value, color], i) => {
      drawCard(50 + i * (smallW + gap), startY, smallW, smallH, color, label, value);
    });

    doc.y = startY + smallH + gap * 2;

    // Section: Payment Split
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('Payment Split (period)');
    doc.moveDown(0.5);
    startY = doc.y;

    drawCard(50, startY, cardW, cardH, '#10B981', 'Online', String(onlineCount));
    drawCard(50 + cardW + gap, startY, cardW, cardH, '#6B7280', 'Offline', String(offlineCount));

    doc.y = startY + cardH + gap;

    // Footer
    doc.fontSize(8).font('Helvetica').fillColor('#000000')
      .text(`Generated on ${new Date().toLocaleString('en-IN')}`, 50, 770, { align: 'center' });

    doc.end();
    return { stream: doc, filename };
  },

  /** Generate facility usage PDF with online/offline breakdown */
  async facilityUsagePDF(prisma: PrismaClient, from: string, to: string): Promise<{ stream: PDFKit.PDFDocument; filename: string }> {
    const facilityData = await this._facilityUsageData(prisma, from, to);
    const settings = await SettingsService.getMany(prisma, ['academy_name', 'academy_address']);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const filename = `facility-usage-${from}-to-${to}.pdf`;

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text(settings.academy_name || 'StrikersAcademy', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(settings.academy_address || '', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text('Facility Usage Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`${from} to ${to}`, { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);

    // Table header
    const cols = [50, 150, 210, 260, 310, 390, 470];
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Facility', cols[0], doc.y);
    doc.text('Total', cols[1], doc.y);
    doc.text('Online', cols[2], doc.y);
    doc.text('Offline', cols[3], doc.y);
    doc.text('Online Rev', cols[4], doc.y);
    doc.text('Offline Rev', cols[5], doc.y);
    doc.text('Total Rev', cols[6], doc.y);
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

    // Rows
    doc.fontSize(8).font('Helvetica');
    for (const f of facilityData) {
      if (doc.y > 750) doc.addPage();
      const y = doc.y + 5;
      doc.text(f.name.slice(0, 20), cols[0], y, { width: 95 });
      doc.text(String(f.total), cols[1], y);
      doc.text(String(f.online), cols[2], y);
      doc.text(String(f.offline), cols[3], y);
      doc.text(formatPaise(f.onlineRevenue), cols[4], y, { width: 75 });
      doc.text(formatPaise(f.offlineRevenue), cols[5], y, { width: 75 });
      doc.text(formatPaise(f.totalRevenue), cols[6], y, { width: 75 });
      doc.moveDown(0.3);
    }

    // Footer
    doc.fontSize(8).font('Helvetica')
      .text(`Generated on ${new Date().toLocaleString('en-IN')}`, 50, 770, { align: 'center' });

    doc.end();
    return { stream: doc, filename };
  },

  /** Generate facility usage CSV with online/offline breakdown */
  async facilityUsageCSV(prisma: PrismaClient, from: string, to: string): Promise<{ csv: string; filename: string }> {
    const facilityData = await this._facilityUsageData(prisma, from, to);

    const header = 'Facility,Total Bookings,Online Bookings,Offline Bookings,Online Revenue,Offline Revenue,Total Revenue';
    const rows = facilityData.map((f) =>
      [
        `"${f.name}"`,
        f.total,
        f.online,
        f.offline,
        (f.onlineRevenue / 100).toFixed(2),
        (f.offlineRevenue / 100).toFixed(2),
        (f.totalRevenue / 100).toFixed(2),
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');
    return { csv, filename: `facility-usage-${from}-to-${to}.csv` };
  },

  /** Internal: fetch facility usage data with online/offline split */
  async _facilityUsageData(prisma: PrismaClient, from: string, to: string) {
    const bookings = await prisma.booking.findMany({
      where: { slot: { date: { gte: from, lte: to } } },
      include: {
        slot: { include: { facility: true } },
        payment: true,
      },
    });

    const map: Record<string, { name: string; total: number; online: number; offline: number; onlineRevenue: number; offlineRevenue: number; totalRevenue: number }> = {};

    for (const b of bookings as any[]) {
      const fname = b.slot?.facility?.name ?? 'Unknown';
      if (!map[fname]) map[fname] = { name: fname, total: 0, online: 0, offline: 0, onlineRevenue: 0, offlineRevenue: 0, totalRevenue: 0 };
      map[fname].total += 1;
      const amt = (b.payment?.status === 'SUCCESS') ? (b.payment.amount || 0) : 0;
      if (b.paymentMethod === 'ONLINE') {
        map[fname].online += 1;
        map[fname].onlineRevenue += amt;
      } else {
        map[fname].offline += 1;
        map[fname].offlineRevenue += amt;
      }
      map[fname].totalRevenue += amt;
    }

    return Object.values(map).sort((a, b) => b.totalRevenue - a.totalRevenue);
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
