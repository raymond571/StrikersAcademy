/**
 * Scheduled job — expires stale PENDING online bookings.
 * Runs every 5 minutes. Cancels PENDING bookings older than 15 minutes
 * where the customer abandoned the Razorpay payment flow.
 * Offline PENDING bookings are NOT expired (they await admin confirmation).
 */
import { PrismaClient } from '@prisma/client';

const STALE_MINUTES = 15;
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let timer: ReturnType<typeof setInterval> | null = null;

export function startPendingBookingCleanup(prisma: PrismaClient) {
  async function cleanup() {
    try {
      const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

      const staleBookings = await prisma.booking.findMany({
        where: {
          status: 'PENDING',
          paymentMethod: 'ONLINE',
          createdAt: { lt: cutoff },
        },
        select: { id: true },
      });

      if (staleBookings.length === 0) return;

      const ids = staleBookings.map((b) => b.id);

      // Cancel bookings
      await prisma.booking.updateMany({
        where: { id: { in: ids } },
        data: { status: 'CANCELLED' },
      });

      // Mark their payments as FAILED
      await prisma.payment.updateMany({
        where: {
          bookingId: { in: ids },
          status: 'PENDING',
        },
        data: { status: 'FAILED' },
      });

      console.log(`[expire-pending] Cancelled ${ids.length} stale PENDING booking(s)`);
    } catch (err) {
      console.error('[expire-pending] Cleanup failed:', err);
    }
  }

  // Run immediately on startup, then every INTERVAL_MS
  cleanup();
  timer = setInterval(cleanup, INTERVAL_MS);
  console.log(`[expire-pending] Started: expires ONLINE PENDING bookings older than ${STALE_MINUTES}min (checks every ${INTERVAL_MS / 60000}min)`);
}

export function stopPendingBookingCleanup() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
