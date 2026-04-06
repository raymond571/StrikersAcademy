/**
 * Scheduled job — sends email reminders 1 hour before slot start.
 * Runs every 10 minutes. Checks for CONFIRMED bookings starting in 50-70 min.
 */
import { PrismaClient } from '@prisma/client';
import { EmailService } from '../services/email.service';

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
let timer: ReturnType<typeof setInterval> | null = null;

export function startBookingReminders(prisma: PrismaClient) {
  async function checkReminders() {
    try {
      // Get current IST time
      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const todayStr = `${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, '0')}-${String(nowIST.getDate()).padStart(2, '0')}`;

      // Window: 50-70 minutes from now
      const min50 = new Date(nowIST.getTime() + 50 * 60 * 1000);
      const min70 = new Date(nowIST.getTime() + 70 * 60 * 1000);
      const timeFrom = `${String(min50.getHours()).padStart(2, '0')}:${String(min50.getMinutes()).padStart(2, '0')}`;
      const timeTo = `${String(min70.getHours()).padStart(2, '0')}:${String(min70.getMinutes()).padStart(2, '0')}`;

      // Find confirmed bookings for today in the reminder window
      const bookings = await prisma.booking.findMany({
        where: {
          status: 'CONFIRMED',
          slot: {
            date: todayStr,
            startTime: { gte: timeFrom, lte: timeTo },
          },
        },
        select: { id: true, notes: true },
      });

      // Filter out already-reminded bookings (use notes field to track)
      const toRemind = bookings.filter((b: any) => !b.notes?.includes('[REMINDED]'));

      for (const b of toRemind) {
        await EmailService.sendReminder(prisma, b.id);
        // Mark as reminded
        await prisma.booking.update({
          where: { id: b.id },
          data: { notes: ((b.notes || '') + ' [REMINDED]').trim() },
        });
      }

      if (toRemind.length > 0) {
        console.log(`[reminders] Sent ${toRemind.length} reminder(s)`);
      }
    } catch (err) {
      console.error('[reminders] Check failed:', err);
    }
  }

  checkReminders();
  timer = setInterval(checkReminders, INTERVAL_MS);
  console.log(`[reminders] Started: checks every ${INTERVAL_MS / 60000}min for sessions starting in ~1 hour`);
}

export function stopBookingReminders() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
