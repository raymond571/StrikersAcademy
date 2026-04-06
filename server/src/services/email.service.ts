/**
 * EmailService — sends transactional emails via GoDaddy SMTP.
 * Uses nodemailer with SSL. Gracefully skips if SMTP not configured.
 */
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { SettingsService } from './settings.service';
import { InvoiceService } from './invoice.service';

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null; // SMTP not configured, skip emails
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

function getFromAddress(): string {
  return process.env.SMTP_USER || 'noreply@strickersacademy.in';
}

function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL || process.env.SMTP_USER || '';
}

async function sendMail(to: string, subject: string, html: string, attachments?: any[]) {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[email] SMTP not configured, skipping: ${subject} → ${to}`);
    return;
  }

  try {
    await transport.sendMail({
      from: `"StrikersAcademy" <${getFromAddress()}>`,
      to,
      subject,
      html,
      attachments,
    });
    console.log(`[email] Sent: ${subject} → ${to}`);
  } catch (err: any) {
    console.error(`[email] Failed: ${subject} → ${to}:`, err.message);
  }
}

// ── HTML Templates ──────────────────────────────────────────

function baseTemplate(title: string, body: string, academyName: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <div style="background:#f97316;padding:20px 24px;">
    <h1 style="color:#fff;margin:0;font-size:20px;">${academyName}</h1>
    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:13px;">${title}</p>
  </div>
  <div style="padding:24px;">
    ${body}
  </div>
  <div style="background:#f3f4f6;padding:16px 24px;text-align:center;font-size:11px;color:#9ca3af;">
    ${academyName} — Chennai, Tamil Nadu<br>
    This is an automated message. Please do not reply.
  </div>
</div>
</body>
</html>`;
}

function bookingRow(facility: string, date: string, time: string, amount: number): string {
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${facility}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${date}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;">${time}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;text-align:right;">${formatPaise(amount)}</td>
  </tr>`;
}

function bookingTable(bookings: any[]): string {
  const rows = bookings.map((b: any) =>
    bookingRow(
      b.slot?.facility?.name || '',
      b.slot?.date || '',
      `${b.slot?.startTime || ''}-${b.slot?.endTime || ''}`,
      b.payment?.amount || 0,
    )
  ).join('');

  const total = bookings.reduce((s: number, b: any) => s + (b.payment?.amount || 0), 0);

  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:8px 12px;text-align:left;">Facility</th>
        <th style="padding:8px 12px;text-align:left;">Date</th>
        <th style="padding:8px 12px;text-align:left;">Time</th>
        <th style="padding:8px 12px;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="background:#f9fafb;font-weight:bold;">
        <td colspan="3" style="padding:8px 12px;">Total</td>
        <td style="padding:8px 12px;text-align:right;">${formatPaise(total)}</td>
      </tr>
    </tfoot>
  </table>`;
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    CONFIRMED: '#10b981',
    PENDING: '#f59e0b',
    CANCELLED: '#ef4444',
    REFUNDED: '#6b7280',
  };
  const bg = colors[status] || '#6b7280';
  return `<span style="display:inline-block;background:${bg};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:bold;">${status}</span>`;
}

// ── Public API ──────────────────────────────────────────────

export const EmailService = {
  /** Send booking confirmation to user + admin */
  async sendBookingConfirmation(prisma: PrismaClient, bookingIds: string[]) {
    const bookings = await prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        slot: { include: { facility: true } },
        payment: true,
      },
    });

    if (!bookings.length) return;

    const user = bookings[0].user;
    const academySettings = await SettingsService.getMany(prisma, ['academy_name']);
    const academyName = academySettings.academy_name || 'StrikersAcademy';
    const paymentMethod = bookings[0].paymentMethod;
    const total = bookings.reduce((s: number, b: any) => s + (b.payment?.amount || 0), 0);

    // Generate PDF invoice
    let invoiceAttachment: any = null;
    try {
      const { stream, filename } = await InvoiceService.generateInvoice(
        prisma, bookings[0].id, bookings[0].userId, 'ADMIN',
      );
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve());
      });
      invoiceAttachment = {
        filename,
        content: Buffer.concat(chunks),
        contentType: 'application/pdf',
      };
    } catch { /* skip invoice if generation fails */ }

    const body = `
      <h2 style="color:#111827;margin:0 0 8px;">Booking Confirmed!</h2>
      <p style="color:#6b7280;margin:0 0 16px;">Hi ${user.name}, your booking has been created.</p>
      ${bookingTable(bookings)}
      <p style="font-size:14px;color:#374151;">
        <strong>Payment:</strong> ${paymentMethod === 'ONLINE' ? 'Pay Online (UPI/Razorpay)' : 'Pay at Venue'}<br>
        <strong>Status:</strong> ${statusBadge(bookings[0].status)}
      </p>
      ${paymentMethod === 'ONLINE' && bookings[0].status === 'PENDING'
        ? '<p style="color:#f59e0b;font-size:13px;">Please complete payment to confirm your booking.</p>'
        : ''}
      <p style="font-size:12px;color:#9ca3af;margin-top:16px;">
        You can manage your bookings at <a href="https://strickersacademy.in/dashboard">strickersacademy.in/dashboard</a>
      </p>`;

    // Email to user
    if (user.email) {
      await sendMail(
        user.email,
        `Booking ${bookings[0].status === 'CONFIRMED' ? 'Confirmed' : 'Created'} — ${academyName}`,
        baseTemplate('Booking Confirmation', body, academyName),
        invoiceAttachment ? [invoiceAttachment] : undefined,
      );
    }

    // Email to admin
    const adminEmail = getAdminEmail();
    if (adminEmail) {
      const adminBody = `
        <h2 style="color:#111827;margin:0 0 8px;">New Booking</h2>
        <p style="color:#6b7280;margin:0 0 16px;">
          <strong>${user.name}</strong> (${user.phone}) made a booking.
        </p>
        ${bookingTable(bookings)}
        <p style="font-size:14px;color:#374151;">
          <strong>Payment:</strong> ${paymentMethod}<br>
          <strong>Total:</strong> ${formatPaise(total)}
        </p>`;

      await sendMail(
        adminEmail,
        `New Booking from ${user.name} — ${formatPaise(total)}`,
        baseTemplate('New Booking Notification', adminBody, academyName),
      );
    }
  },

  /** Send cancellation/refund notification to user + admin */
  async sendCancellationEmail(prisma: PrismaClient, bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        slot: { include: { facility: true } },
        payment: true,
      },
    });

    if (!booking) return;
    const academySettings = await SettingsService.getMany(prisma, ['academy_name']);
    const academyName = academySettings.academy_name || 'StrikersAcademy';
    const isRefunded = booking.status === 'REFUNDED';

    const body = `
      <h2 style="color:#111827;margin:0 0 8px;">Booking ${isRefunded ? 'Refunded' : 'Cancelled'}</h2>
      <p style="color:#6b7280;margin:0 0 16px;">Hi ${booking.user.name},</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;font-size:14px;color:#991b1b;">
          <strong>${booking.slot?.facility?.name}</strong> — ${booking.slot?.date} at ${booking.slot?.startTime}-${booking.slot?.endTime}
        </p>
        <p style="margin:8px 0 0;font-size:14px;">Status: ${statusBadge(booking.status)}</p>
      </div>
      ${isRefunded && booking.payment ? `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0;font-size:14px;color:#166534;">
            <strong>Refund:</strong> ${formatPaise(booking.payment.refundAmount || booking.payment.amount)}
            ${booking.payment.cancellationCharge ? `<br><span style="color:#991b1b;">Cancellation charge: ${formatPaise(booking.payment.cancellationCharge)}</span>` : ''}
          </p>
        </div>` : ''}`;

    if (booking.user.email) {
      await sendMail(
        booking.user.email,
        `Booking ${isRefunded ? 'Refunded' : 'Cancelled'} — ${academyName}`,
        baseTemplate(`Booking ${isRefunded ? 'Refund' : 'Cancellation'}`, body, academyName),
      );
    }

    // Admin notification
    const adminEmail = getAdminEmail();
    if (adminEmail) {
      await sendMail(
        adminEmail,
        `Booking ${isRefunded ? 'Refunded' : 'Cancelled'} — ${booking.user.name}`,
        baseTemplate('Cancellation Alert', `
          <p><strong>${booking.user.name}</strong> (${booking.user.phone}) ${isRefunded ? 'refunded' : 'cancelled'} a booking.</p>
          <p>${booking.slot?.facility?.name} — ${booking.slot?.date} ${booking.slot?.startTime}-${booking.slot?.endTime}</p>
          ${booking.payment ? `<p>Amount: ${formatPaise(booking.payment.amount)}</p>` : ''}
        `, academyName),
      );
    }
  },

  /** Send 1-hour reminder email to user */
  async sendReminder(prisma: PrismaClient, bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: { select: { name: true, email: true } },
        slot: { include: { facility: true } },
      },
    });

    if (!booking || !booking.user.email) return;
    if (booking.status !== 'CONFIRMED') return;

    const academySettings = await SettingsService.getMany(prisma, ['academy_name']);
    const academyName = academySettings.academy_name || 'StrikersAcademy';

    const body = `
      <h2 style="color:#111827;margin:0 0 8px;">Reminder: Your Session Starts Soon!</h2>
      <p style="color:#6b7280;margin:0 0 16px;">Hi ${booking.user.name},</p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0;font-size:16px;color:#1e40af;font-weight:bold;">
          ${booking.slot?.facility?.name}
        </p>
        <p style="margin:8px 0 0;font-size:14px;color:#1e40af;">
          ${booking.slot?.date} at ${booking.slot?.startTime} - ${booking.slot?.endTime}
        </p>
      </div>
      <p style="font-size:14px;color:#374151;">
        Your session is starting in about <strong>1 hour</strong>. See you there!
      </p>`;

    await sendMail(
      booking.user.email,
      `Reminder: Session at ${booking.slot?.startTime} today — ${academyName}`,
      baseTemplate('Session Reminder', body, academyName),
    );
  },

  /** Send payment confirmation email with invoice */
  async sendPaymentConfirmation(prisma: PrismaClient, bookingIds: string[]) {
    const bookings = await prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      include: {
        user: { select: { name: true, email: true } },
        slot: { include: { facility: true } },
        payment: true,
      },
    });

    if (!bookings.length || !bookings[0].user.email) return;

    const academySettings = await SettingsService.getMany(prisma, ['academy_name']);
    const academyName = academySettings.academy_name || 'StrikersAcademy';
    const total = bookings.reduce((s: number, b: any) => s + (b.payment?.amount || 0), 0);

    // Generate invoice PDF
    let invoiceAttachment: any = null;
    try {
      const { stream, filename } = await InvoiceService.generateInvoice(
        prisma, bookings[0].id, bookings[0].userId, 'ADMIN',
      );
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve());
      });
      invoiceAttachment = {
        filename,
        content: Buffer.concat(chunks),
        contentType: 'application/pdf',
      };
    } catch { /* skip */ }

    const body = `
      <h2 style="color:#111827;margin:0 0 8px;">Payment Confirmed!</h2>
      <p style="color:#6b7280;margin:0 0 16px;">Hi ${bookings[0].user.name}, your payment of <strong>${formatPaise(total)}</strong> has been received.</p>
      ${bookingTable(bookings)}
      <p style="font-size:14px;color:#10b981;font-weight:bold;">Your booking is confirmed. See you at the academy!</p>
      <p style="font-size:12px;color:#9ca3af;">Invoice attached as PDF.</p>`;

    await sendMail(
      bookings[0].user.email,
      `Payment Confirmed — ${formatPaise(total)} — ${academyName}`,
      baseTemplate('Payment Confirmation', body, academyName),
      invoiceAttachment ? [invoiceAttachment] : undefined,
    );
  },
};
