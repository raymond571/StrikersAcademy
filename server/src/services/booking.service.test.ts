import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingService } from './booking.service';

// Mock PaymentService
vi.mock('./payment.service', () => ({
  PaymentService: {
    refund: vi.fn().mockResolvedValue({ id: 'rfnd_1' }),
    createOrder: vi.fn().mockResolvedValue({ id: 'order_extra_1' }),
    fetchPayment: vi.fn().mockResolvedValue({ amount: 500, amount_refunded: 0 }),
  },
}));
import { PaymentService } from './payment.service';

// Mock SettingsService
vi.mock('./settings.service', () => ({
  SettingsService: {
    getCancellationChargePercent: vi.fn().mockResolvedValue(10), // 10% charge
  },
}));

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
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', status: 'CONFIRMED',
      slot: {
        date: '2099-12-31',
        startTime: '18:00',
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
    // Slot starts very soon (use today's date with a time 30 mins from now)
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60 * 1000);
    const soonDate = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    const soonTime = `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}`;
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', status: 'CONFIRMED',
      slot: {
        date: soonDate,
        startTime: soonTime,
      },
    });

    await expect(
      BookingService.cancelBooking(prisma, 'bk-1', 'user-1', 'CUSTOMER'),
    ).rejects.toThrow('at least 2 hours');
  });

  it('allows ADMIN to cancel even within cutoff window', async () => {
    const now = new Date();
    const soon2 = new Date(now.getTime() + 30 * 60 * 1000);
    const soonDate2 = `${soon2.getFullYear()}-${String(soon2.getMonth() + 1).padStart(2, '0')}-${String(soon2.getDate()).padStart(2, '0')}`;
    const soonTime2 = `${String(soon2.getHours()).padStart(2, '0')}:${String(soon2.getMinutes()).padStart(2, '0')}`;
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', status: 'CONFIRMED',
      slot: {
        date: soonDate2,
        startTime: soonTime2,
      },
      payment: null,
    });
    prisma.booking.update.mockResolvedValue({ id: 'bk-1', status: 'CANCELLED', payment: null });

    const result = await BookingService.cancelBooking(prisma, 'bk-1', 'admin-1', 'ADMIN');
    expect(result.status).toBe('CANCELLED');
  });

  it('sets booking to REFUNDED and issues Razorpay refund for paid online booking', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', status: 'CONFIRMED',
      slot: {
        date: '2099-12-31',
        startTime: '18:00',
      },
      payment: { id: 'pay-1', status: 'SUCCESS', razorpayPaymentId: 'pay_rzp_1', amount: 500 },
    });
    prisma.booking.update.mockResolvedValue({
      id: 'bk-1', status: 'REFUNDED',
      payment: { id: 'pay-1', status: 'REFUNDED' },
    });

    const result = await BookingService.cancelBooking(prisma, 'bk-1', 'user-1', 'CUSTOMER');

    // Should call Razorpay refund (500 - 10% charge = 450)
    expect(PaymentService.refund).toHaveBeenCalledWith('pay_rzp_1', 450);
    // Should update payment to REFUNDED
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'REFUNDED' }),
      }),
    );
    // Should set booking status to REFUNDED (not CANCELLED)
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'REFUNDED' },
      }),
    );
  });

  it('sets booking to CANCELLED (not REFUNDED) for offline/unpaid booking', async () => {
    vi.mocked(PaymentService.refund).mockClear();
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', status: 'CONFIRMED',
      slot: {
        date: '2099-12-31',
        startTime: '18:00',
      },
      payment: { id: 'pay-1', status: 'PENDING', razorpayPaymentId: null, amount: 500 },
    });
    prisma.booking.update.mockResolvedValue({ id: 'bk-1', status: 'CANCELLED', payment: null });

    await BookingService.cancelBooking(prisma, 'bk-1', 'user-1', 'CUSTOMER');

    expect(PaymentService.refund).not.toHaveBeenCalled();
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'CANCELLED' },
      }),
    );
  });

  it('handles already fully refunded payment gracefully on cancel', async () => {
    vi.mocked(PaymentService.refund).mockClear();
    vi.mocked(PaymentService.fetchPayment).mockResolvedValueOnce({ amount: 500, amount_refunded: 500 });
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', status: 'CONFIRMED',
      slot: {
        date: '2099-12-31',
        startTime: '18:00',
      },
      payment: { id: 'pay-1', status: 'SUCCESS', razorpayPaymentId: 'pay_rzp_1', amount: 500 },
    });
    prisma.booking.update.mockResolvedValue({
      id: 'bk-1', status: 'REFUNDED', payment: { id: 'pay-1', status: 'REFUNDED' },
    });

    const result = await BookingService.cancelBooking(prisma, 'bk-1', 'user-1', 'CUSTOMER');

    // Should NOT call refund since remaining is 0
    expect(PaymentService.refund).not.toHaveBeenCalled();
    // Should still mark as REFUNDED
    expect(result.status).toBe('REFUNDED');
  });

  it('refunds only the remaining amount when partial refund was already issued', async () => {
    vi.mocked(PaymentService.refund).mockClear();
    vi.mocked(PaymentService.fetchPayment).mockResolvedValueOnce({ amount: 1500, amount_refunded: 1000 });
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', status: 'CONFIRMED',
      slot: {
        date: '2099-12-31',
        startTime: '18:00',
      },
      payment: { id: 'pay-1', status: 'SUCCESS', razorpayPaymentId: 'pay_rzp_1', amount: 500 },
    });
    prisma.booking.update.mockResolvedValue({
      id: 'bk-1', status: 'REFUNDED', payment: { id: 'pay-1', status: 'REFUNDED' },
    });

    await BookingService.cancelBooking(prisma, 'bk-1', 'user-1', 'CUSTOMER');

    // Remaining on Razorpay: 500. Charge: 10% of 500 = 50. Refund: min(450, 500) = 450
    expect(PaymentService.refund).toHaveBeenCalledWith('pay_rzp_1', 450);
  });
});

describe('BookingService.updateSlot', () => {
  let prisma: any;

  const futureSlot = {
    id: 'slot-old', facilityId: 'fac-1', date: '2026-12-01', startTime: '10:00', endTime: '11:00',
    capacity: 4, priceOverride: null,
    facility: { id: 'fac-1', isActive: true, pricePerSlot: 500 },
  };

  const newSlot = {
    id: 'slot-new', facilityId: 'fac-2', date: '2026-12-01', startTime: '14:00', endTime: '15:00',
    capacity: 4, priceOverride: null,
    facility: { id: 'fac-2', isActive: true, pricePerSlot: 1500 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = {
      booking: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
      slot: { findUnique: vi.fn() },
      payment: { update: vi.fn() },
      availabilityBlock: { findMany: vi.fn() },
      $transaction: vi.fn((cb: any) => cb(prisma)),
    };

    // Default: booking exists, user owns it, CONFIRMED
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', slotId: 'slot-old', status: 'CONFIRMED',
      slot: futureSlot,
      payment: { id: 'pay-1', status: 'PENDING', amount: 500, razorpayPaymentId: null },
    });

    prisma.slot.findUnique.mockResolvedValue(newSlot);
    prisma.availabilityBlock.findMany.mockResolvedValue([]);
    prisma.booking.count.mockResolvedValue(0);
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.update.mockResolvedValue({ id: 'bk-1', slotId: 'slot-new' });
  });

  it('updates booking to new slot', async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce({
        id: 'bk-1', userId: 'user-1', slotId: 'slot-old', status: 'CONFIRMED',
        slot: futureSlot,
        payment: { id: 'pay-1', status: 'PENDING', amount: 500, razorpayPaymentId: null },
      })
      .mockResolvedValueOnce({
        id: 'bk-1', slotId: 'slot-new', slot: newSlot, payment: { id: 'pay-1', amount: 1500 },
      });

    const result = await BookingService.updateSlot(prisma, 'bk-1', 'slot-new', 'user-1', 'CUSTOMER', 'OFFLINE');
    expect(result.newPrice).toBe(1500);
    expect(result.oldPrice).toBe(500);
    expect(result.priceDiff).toBe(1000);
  });

  it('throws 404 when booking not found', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);
    await expect(
      BookingService.updateSlot(prisma, 'x', 'slot-new', 'user-1', 'CUSTOMER'),
    ).rejects.toThrow('not found');
  });

  it('throws 403 when customer tries to update another users booking', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'other-user', slotId: 'slot-old', status: 'CONFIRMED',
      slot: futureSlot, payment: null,
    });
    await expect(
      BookingService.updateSlot(prisma, 'bk-1', 'slot-new', 'user-1', 'CUSTOMER'),
    ).rejects.toThrow('do not have access');
  });

  it('throws 400 when booking is CANCELLED', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'bk-1', userId: 'user-1', slotId: 'slot-old', status: 'CANCELLED',
      slot: futureSlot, payment: null,
    });
    await expect(
      BookingService.updateSlot(prisma, 'bk-1', 'slot-new', 'user-1', 'CUSTOMER'),
    ).rejects.toThrow('Only PENDING or CONFIRMED');
  });

  it('throws 400 when new slot is same as current', async () => {
    await expect(
      BookingService.updateSlot(prisma, 'bk-1', 'slot-old', 'user-1', 'CUSTOMER'),
    ).rejects.toThrow('same as the current');
  });

  it('throws 400 when price goes up but no extraPaymentMethod', async () => {
    await expect(
      BookingService.updateSlot(prisma, 'bk-1', 'slot-new', 'user-1', 'CUSTOMER'),
    ).rejects.toThrow('extraPaymentMethod is required');
  });

  it('throws 409 when new slot is fully booked', async () => {
    prisma.booking.count.mockResolvedValue(4); // capacity is 4
    await expect(
      BookingService.updateSlot(prisma, 'bk-1', 'slot-new', 'user-1', 'CUSTOMER', 'OFFLINE'),
    ).rejects.toThrow('fully booked');
  });

  it('issues partial Razorpay refund when price goes down on paid online booking', async () => {
    const cheapSlot = { ...newSlot, facility: { ...newSlot.facility, pricePerSlot: 300 } };
    prisma.slot.findUnique.mockResolvedValue(cheapSlot);
    prisma.booking.findUnique
      .mockResolvedValueOnce({
        id: 'bk-1', userId: 'user-1', slotId: 'slot-old', status: 'CONFIRMED',
        slot: futureSlot,
        payment: { id: 'pay-1', status: 'SUCCESS', amount: 500, razorpayPaymentId: 'pay_rzp_1' },
      })
      .mockResolvedValueOnce({
        id: 'bk-1', slotId: 'slot-new', slot: cheapSlot, payment: { id: 'pay-1', amount: 300 },
      });

    const result = await BookingService.updateSlot(prisma, 'bk-1', 'slot-new', 'user-1', 'CUSTOMER');
    expect(PaymentService.refund).toHaveBeenCalledWith('pay_rzp_1', 200); // refund the difference
    expect(result.refundedAmount).toBe(200);
  });

  it('creates Razorpay order for extra payment when price goes up with ONLINE', async () => {
    prisma.booking.findUnique
      .mockResolvedValueOnce({
        id: 'bk-1', userId: 'user-1', slotId: 'slot-old', status: 'CONFIRMED',
        slot: futureSlot,
        payment: { id: 'pay-1', status: 'PENDING', amount: 500, razorpayPaymentId: null },
      })
      .mockResolvedValueOnce({
        id: 'bk-1', slotId: 'slot-new', slot: newSlot, payment: { id: 'pay-1', amount: 1500 },
      });

    const result = await BookingService.updateSlot(prisma, 'bk-1', 'slot-new', 'user-1', 'CUSTOMER', 'ONLINE');
    expect(PaymentService.createOrder).toHaveBeenCalledWith(1000, 'bk-1-extra');
    expect(result.extraPayment).toBeDefined();
    expect(result.extraPayment!.razorpayOrderId).toBe('order_extra_1');
    expect(result.extraPayment!.amount).toBe(1000);
  });
});
