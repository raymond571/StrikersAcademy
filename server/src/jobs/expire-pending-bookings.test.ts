import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startPendingBookingCleanup, stopPendingBookingCleanup } from './expire-pending-bookings';

describe('expire-pending-bookings', () => {
  let prisma: any;

  beforeEach(() => {
    vi.useFakeTimers();
    prisma = {
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
  });

  afterEach(() => {
    stopPendingBookingCleanup();
    vi.useRealTimers();
  });

  it('queries for stale PENDING ONLINE bookings older than 15 minutes', async () => {
    startPendingBookingCleanup(prisma);

    // Let the immediate cleanup() call resolve
    await vi.advanceTimersByTimeAsync(0);

    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        paymentMethod: 'ONLINE',
        createdAt: { lt: expect.any(Date) },
      },
      select: { id: true },
    });
  });

  it('cancels stale bookings and marks payments as FAILED', async () => {
    prisma.booking.findMany.mockResolvedValueOnce([
      { id: 'bk-stale-1' },
      { id: 'bk-stale-2' },
    ]);

    startPendingBookingCleanup(prisma);
    await vi.advanceTimersByTimeAsync(0);

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['bk-stale-1', 'bk-stale-2'] } },
      data: { status: 'CANCELLED' },
    });

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: {
        bookingId: { in: ['bk-stale-1', 'bk-stale-2'] },
        status: 'PENDING',
      },
      data: { status: 'FAILED' },
    });
  });

  it('does nothing when no stale bookings exist', async () => {
    prisma.booking.findMany.mockResolvedValueOnce([]);

    startPendingBookingCleanup(prisma);
    await vi.advanceTimersByTimeAsync(0);

    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it('does not expire OFFLINE pending bookings', async () => {
    startPendingBookingCleanup(prisma);
    await vi.advanceTimersByTimeAsync(0);

    // The query specifically filters for ONLINE only
    const call = prisma.booking.findMany.mock.calls[0][0];
    expect(call.where.paymentMethod).toBe('ONLINE');
  });
});
