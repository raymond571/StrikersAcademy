/**
 * InvoiceService — generates PDF invoices for bookings.
 */
import PDFDocument from 'pdfkit';
import { PrismaClient } from '@prisma/client';
import { SettingsService } from './settings.service';

function formatPaise(paise: number): string {
  return `Rs. ${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export const InvoiceService = {
  /**
   * Generate a PDF invoice for a single booking or a batch.
   * Returns a readable stream of the PDF.
   */
  async generateInvoice(
    prisma: PrismaClient,
    bookingId: string,
    userId: string,
    userRole: string,
  ): Promise<{ stream: PDFKit.PDFDocument; filename: string }> {
    // Get the booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        slot: { include: { facility: true } },
        payment: true,
        user: { select: { name: true, phone: true, email: true } },
      },
    });

    if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
    if (booking.userId !== userId && userRole !== 'ADMIN' && userRole !== 'STAFF') {
      throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }

    // If batch booking, get all in the batch
    let bookings: typeof booking[] = [booking];
    if (booking.batchId) {
      bookings = await prisma.booking.findMany({
        where: { batchId: booking.batchId },
        include: {
          slot: { include: { facility: true } },
          payment: true,
          user: { select: { name: true, phone: true, email: true } },
        },
        orderBy: [{ slot: { date: 'asc' } }, { slot: { startTime: 'asc' } }],
      });
    }

    // Get academy settings
    const settings = await SettingsService.getMany(prisma, [
      'academy_name', 'academy_address', 'academy_phone', 'academy_email', 'academy_gst',
    ]);

    // Calculate totals
    const totalAmount = bookings.reduce((sum, b) => sum + (b.payment?.amount ?? 0), 0);
    const totalRefund = bookings.reduce((sum, b) => sum + (b.payment?.refundAmount ?? 0), 0);
    const totalCharge = bookings.reduce((sum, b) => sum + (b.payment?.cancellationCharge ?? 0), 0);

    // Generate PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const invoiceNo = `INV-${booking.batchId?.replace('batch_', '') || booking.id.slice(-8).toUpperCase()}`;
    const filename = `${invoiceNo}.pdf`;

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(settings.academy_name || 'StrikersAcademy', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(settings.academy_address || '', { align: 'center' });
    doc.text(`Phone: ${settings.academy_phone || ''} | Email: ${settings.academy_email || ''}`, { align: 'center' });
    if (settings.academy_gst) {
      doc.text(`GST: ${settings.academy_gst}`, { align: 'center' });
    }

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Invoice details
    doc.fontSize(14).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Invoice No: ${invoiceNo}`);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
    doc.text(`Status: ${booking.status}`);
    doc.moveDown();

    // Customer details
    doc.font('Helvetica-Bold').text('Customer:');
    doc.font('Helvetica');
    doc.text(`Name: ${booking.user.name}`);
    doc.text(`Phone: ${booking.user.phone}`);
    if (booking.user.email) doc.text(`Email: ${booking.user.email}`);
    doc.moveDown();

    // Booking details table
    doc.font('Helvetica-Bold').text('Booking Details:');
    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y;
    const col1 = 50, col2 = 200, col3 = 320, col4 = 420, col5 = 490;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Facility', col1, tableTop);
    doc.text('Date', col2, tableTop);
    doc.text('Time', col3, tableTop);
    doc.text('Status', col4, tableTop);
    doc.text('Amount', col5, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // Table rows
    let y = tableTop + 22;
    doc.fontSize(9).font('Helvetica');
    for (const b of bookings) {
      doc.text(b.slot?.facility?.name ?? '', col1, y, { width: 145 });
      doc.text(b.slot?.date ?? '', col2, y);
      doc.text(`${b.slot?.startTime ?? ''}-${b.slot?.endTime ?? ''}`, col3, y);
      doc.text(b.status, col4, y);
      doc.text(formatPaise(b.payment?.amount ?? 0), col5, y);
      y += 18;
    }

    doc.moveTo(50, y).lineTo(545, y).stroke();
    y += 10;

    // Totals
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Total:', col4, y);
    doc.text(formatPaise(totalAmount), col5, y);

    if (totalCharge > 0) {
      y += 18;
      doc.font('Helvetica').fontSize(9);
      doc.text('Cancellation Charge:', col4, y);
      doc.text(`- ${formatPaise(totalCharge)}`, col5, y);
    }
    if (totalRefund > 0) {
      y += 18;
      doc.font('Helvetica').fontSize(9);
      doc.text('Refunded:', col4, y);
      doc.text(formatPaise(totalRefund), col5, y);
    }

    // Payment info
    y += 30;
    doc.fontSize(9).font('Helvetica');
    doc.text(`Payment Method: ${booking.paymentMethod}`, 50, y);
    if (booking.payment?.razorpayPaymentId) {
      doc.text(`Razorpay ID: ${booking.payment.razorpayPaymentId}`, 50, y + 15);
    }

    // Footer
    doc.fontSize(8).font('Helvetica')
      .text('Thank you for choosing StrikersAcademy!', 50, 750, { align: 'center' })
      .text('This is a computer-generated invoice.', { align: 'center' });

    doc.end();
    return { stream: doc, filename };
  },
};
