import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from './booking.service';

function createMockTx() {
  return {
    slot: { findUnique: vi.fn() },
    availabilityBlock: { findMany: vi.fn() },
    booking: {
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    payment: { create: vi.fn(), update: vi.fn() },
  };
}

function createMockPrisma(tx: ReturnType<typeof createMockTx>) {
  return {
    $transaction: vi.fn((cb: (tx: any) => any) => cb(tx)),
    booking: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: { update: vi.fn() },
  } as any;
}

const baseSlot = {
  id: 'slot-1',
  facilityId: 'fac-1',
  date: '2026-04-10',
  startTime: '06:00',
  endTime: '07:00',
  capacity: 4,
  priceOverride: null,
  facility: { id: 'fac-1', isActive: true, pricePerSlot: 500 },
};

const baseInput = {
  userId: 'user-1',
  slotId: 'slot-1',
  bookingFor: 'SELF' as const,
  paymentMethod: 'ONLINE' as const,
};

describe('BookingService.createBooking', () => {
  let tx: ReturnType<typeof createMockTx>;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    tx = createMockTx();
    prisma = createMockPrisma(tx);
    vi.clearAllMocks();

    // Default happy path setup
    tx.slot.findUnique.mockResolvedValue(baseSlot);
    tx.availabilityBlock.findMany.mockResolvedValue([]);
    tx.booking.count.mockResolvedValue(0);
    tx.booking.findFirst.mockResolvedValue(null);
    tx.booking.create.mockResolvedValue({
      id: 'bk-1', status: 'PENDING', ...baseInput, slot: baseSlot, createdAt: new Date(),
    });
    tx.payment.create.mockResolvedValue({ id: 'pay-1' });
  });

  it('creates a booking with PENDING status for online payment', async () => {
    const result = await BookingService.createBooking(prisma, baseInput);
    expect(result.id).toBe('bk-1');
    expect(result.effectivePrice).toBe(500);
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ method: 'ONLINE', status: 'PENDING' }),
      }),
    );
  });

  it('creates a booking with CONFIRMED status for offline payment', async () => {
    tx.booking.create.mockResolvedValue({
      id: 'bk-2', status: 'CONFIRMED', ...baseInput, paymentMethod: 'OFFLINE',
      slot: baseSlot, createdAt: new Date(),
    });

    await BookingService.createBooking(prisma, { ...baseInput, paymentMethod: 'OFFLINE' });

    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CONFIRMED', paymentMethod: 'OFFLINE' }),
      }),
    );
  });

  it('uses priceOverride when slot has one', async () => {
    tx.slot.findUnique.mockResolvedValue({ ...baseSlot, priceOverride: 750 });
    tx.booking.create.mockResolvedValue({
      id: 'bk-1', status: 'PENDING', slot: { ...baseSlot, priceOverride: 750 }, createdAt: new Date(),
    });

    const result = await BookingService.createBooking(prisma, baseInput);
    expect(result.effectivePrice).toBe(750);
  });

  it('throws 404 when slot not found', async () => {
    tx.slot.findUnique.mockResolvedValue(null);

    await expect(BookingService.createBooking(prisma, baseInput)).rejects.toThrow('Slot not found');
  });

  it('throws 400 when facility is inactive', async () => {
    tx.slot.findUnique.mockResolvedValue({
      ...baseSlot,
      facility: { ...baseSlot.facility, isActive: false },
    });

    await expect(BookingService.createBooking(prisma, baseInput)).rejects.toThrow('inactive');
  });

  it('throws 400 when slot is blocked by availability block', async () => {
    tx.availabilityBlock.findMany.mockResolvedValue([
      { date: '2026-04-10', startTime: '05:00', endTime: '08:00', facilityId: 'fac-1' },
    ]);

    await expect(BookingService.createBooking(prisma, baseInput)).rejects.toThrow('blocked');
  });

  it('throws 400 for all-day block (no start/end time)', async () => {
    tx.availabilityBlock.findMany.mockResolvedValue([
      { date: '2026-04-10', startTime: null, endTime: null, facilityId: null },
    ]);

    await expect(BookingService.createBooking(prisma, baseInput)).rejects.toThrow('blocked');
  });

  it('throws 409 when slot is at full capacity', async () => {
    tx.booking.count.mockResolvedValue(4); // capacity is 4

    await expect(BookingService.createBooking(prisma, baseInput)).rejects.toThrow('fully booked');
  });

  it('throws 409 when user already has active booking for same slot', async () => {
    tx.booking.findFirst.mockResolvedValue({ id: 'existing-bk' });

    await expect(BookingService.createBooking(prisma, baseInput)).rejects.toThrow('already have an active booking');
  });

  it('requires playerName when booking for CHILD', async () => {
    await expect(
      BookingService.createBooking(prisma, { ...baseInput, bookingFor: 'CHILD' }),
    ).rejects.toThrow('playerName is required');
  });

  it('requires teamName when booking for TEAM', async () => {
    await expect(
      BookingService.createBooking(prisma, { ...baseInput, bookingFor: 'TEAM' }),
    ).rejects.toThrow('teamName is required');
  });

  it('accepts CHILD booking with playerName', async () => {
    tx.booking.create.mockResolvedValue({
      id: 'bk-child', status: 'PENDING', slot: baseSlot, createdAt: new Date(),
    });

    const result = await BookingService.createBooking(prisma, {
      ...baseInput,
      bookingFor: 'CHILD',
      playerName: 'Junior',
    });
    expect(result.id).toBe('bk-child');
  });
});

describe('BookingService.listByUser', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = {
      booking: {
        findMany: vi.fn().mockResolvedValue([{ id: 'bk-1' }, { id: 'bk-2' }]),
        count: vi.fn().mockResolvedValue(15),
      },
    };
  });

  it('returns bookings and total count', async () => {
    const result = await BookingService.listByUser(prisma, 'user-1', 1, 10);
    expect(result.bookings).toHaveLength(2);
    expect(result.total).toBe(15);
  });

  it('applies pagination skip and take', async () => {
    await BookingService.listByUser(prisma, 'user-1', 2, 5);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    );
  });
});

describe('BookingService.getById', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = {
      booking: { findUnique: vi.fn() },
    };
  });

  it('returns booking when user is owner', async () => {
    prisma.booking.findUnique.mockResolvedValue({ id: 'bk-1', userId: 'user-1' });
    const result = await BookingService.getById(prisma, 'bk-1', 'user-1', 'CUSTOMER');
    expect(result.id).toBe('bk-1');
  });

  it('returns booking when user is ADMIN (not owner)', async () => {
    prisma.booking.findUnique.mockResolvedValue({ id: 'bk-1', userId: 'other-user' });
    const result = await BookingService.getById(prisma, 'bk-1', 'admin-1', 'ADMIN');
    expect(result.id).toBe('bk-1');
  });

  it('returns booking when user is STAFF (not owner)', async () => {
    prisma.booking.findUnique.mockResolvedValue({ id: 'bk-1', userId: 'other-user' });
    const result = await BookingService.getById(prisma, 'bk-1', 'staff-1', 'STAFF');
    expect(result.id).toBe('bk-1');
  });

  it('throws 404 when booking not found', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);
    await expect(BookingService.getById(prisma, 'x', 'u', 'CUSTOMER')).rejects.toThrow('not found');
  });

  it('throws 403 when CUSTOMER tries to access another users booking', async () => {
    prisma.booking.findUnique.mockResolvedValue({ id: 'bk-1', userId: 'other-user' });
    await expect(
      BookingService.getById(prisma, 'bk-1', 'user-1', 'CUSTOMER'),
    ).rejects.toThrow('do not have access');
  });
});

describe('BookingService.cancelBooking', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = {
      booking: { findUnique: vi.fn(), update: vi.fn() },
      payment: { update: vi.fn() },
      $transaction: vi.fn((cb: any) => cb(prisma)),
    };
  });

  it('cancels a booking within the cancellation window', async () => {
    const futureDate = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours from now
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', status: 'CONFIRMED',
      slot: {
        date: futureDate.toISOString().split('T')[0],
        startTime: futureDate.toTimeString().slice(0, 5),
      },
      payment: null,
    });
    prisma.booking.update.mockResolvedValue({ id: 'bk-1', status: 'CANCELLED' });

    const result = await BookingService.cancelBooking(prisma, 'bk-1', 'user-1', 'CUSTOMER');
    expect(result.status).toBe('CANCELLED');
  });

  it('throws 404 when booking not found', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);
    await expect(
      BookingService.cancelBooking(prisma, 'x', 'u', 'CUSTOMER'),
    ).rejects.toThrow('not found');
  });

  it('throws 403 when CUSTOMER tries to cancel others booking', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'other', status: 'CONFIRMED',
      slot: { date: '2026-12-01', startTime: '06:00' },
    });
    await expect(
      BookingService.cancelBooking(prisma, 'bk-1', 'user-1', 'CUSTOMER'),
    ).rejects.toThrow('do not have access');
  });

  it('throws 400 when booking is already cancelled', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', status: 'CANCELLED',
      slot: { date: '2026-12-01', startTime: '06:00' },
    });
    await expect(
      BookingService.cancelBooking(prisma, 'bk-1', 'user-1', 'CUSTOMER'),
    ).rejects.toThrow('already cancelled');
  });

  it('throws 400 when cancellation window has passed for CUSTOMER', async () => {
    // Slot starts in 30 minutes (less than 2 hours)
    const soonDate = new Date(Date.now() + 30 * 60 * 1000);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', status: 'CONFIRMED',
      slot: {
        date: soonDate.toISOString().split('T')[0],
        startTime: soonDate.toTimeString().slice(0, 5),
      },
    });

    await expect(
      BookingService.cancelBooking(prisma, 'bk-1', 'user-1', 'CUSTOMER'),
    ).rejects.toThrow('at least 2 hours');
  });

  it('allows ADMIN to cancel even within cutoff window', async () => {
    const soonDate = new Date(Date.now() + 30 * 60 * 1000);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', status: 'CONFIRMED',
      slot: {
        date: soonDate.toISOString().split('T')[0],
        startTime: soonDate.toTimeString().slice(0, 5),
      },
      payment: null,
    });
    prisma.booking.update.mockResolvedValue({ id: 'bk-1', status: 'CANCELLED', payment: null });

    const result = await BookingService.cancelBooking(prisma, 'bk-1', 'admin-1', 'ADMIN');
    expect(result.status).toBe('CANCELLED');
  });

  it('marks online payment for refund when cancelling paid booking', async () => {
    const futureDate = new Date(Date.now() + 4 * 60 * 60 * 1000);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', status: 'CONFIRMED',
      slot: {
        date: futureDate.toISOString().split('T')[0],
        startTime: futureDate.toTimeString().slice(0, 5),
      },
      payment: { id: 'pay-1', status: 'SUCCESS' },
    });
    prisma.booking.update.mockResolvedValue({
      id: 'bk-1', status: 'CANCELLED',
      payment: { id: 'pay-1', status: 'SUCCESS' },
    });

    await BookingService.cancelBooking(prisma, 'bk-1', 'user-1', 'CUSTOMER');

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'REFUNDED' }),
      }),
    );
  });
});
