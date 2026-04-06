import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FacilityService } from './facility.service';

function createMockPrisma() {
  return {
    facility: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    slot: { findMany: vi.fn() },
    availabilityBlock: { findMany: vi.fn() },
  } as any;
}

describe('FacilityService.listActive', () => {
  it('returns only active facilities sorted by name', async () => {
    const prisma = createMockPrisma();
    prisma.facility.findMany.mockResolvedValue([
      { id: 'f1', name: 'Net 1', isActive: true },
      { id: 'f2', name: 'Turf A', isActive: true },
    ]);

    const result = await FacilityService.listActive(prisma);
    expect(result).toHaveLength(2);
    expect(prisma.facility.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
    );
  });
});

describe('FacilityService.getById', () => {
  it('returns facility when found', async () => {
    const prisma = createMockPrisma();
    prisma.facility.findUnique.mockResolvedValue({ id: 'f1', name: 'Net 1' });

    const result = await FacilityService.getById(prisma, 'f1');
    expect(result.id).toBe('f1');
  });

  it('throws 404 when facility not found', async () => {
    const prisma = createMockPrisma();
    prisma.facility.findUnique.mockResolvedValue(null);

    await expect(FacilityService.getById(prisma, 'nonexistent')).rejects.toThrow('Facility not found');
  });
});

describe('FacilityService.getSlots', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.facility.findUnique.mockResolvedValue({ id: 'f1', pricePerSlot: 500 });
    prisma.availabilityBlock.findMany.mockResolvedValue([]);
  });

  it('returns enriched slots with availability info', async () => {
    prisma.slot.findMany.mockResolvedValue([
      {
        id: 's1', facilityId: 'f1', date: '2026-04-10', startTime: '06:00', endTime: '07:00',
        capacity: 4, priceOverride: null,
        _count: { bookings: 2 },
      },
    ]);

    const result = await FacilityService.getSlots(prisma, 'f1', '2026-04-10', false);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expect.objectContaining({
      id: 's1',
      bookedCount: 2,
      isAvailable: true,
      isBlocked: false,
      effectivePrice: 500,
    }));
  });

  it('marks slot as unavailable when at full capacity', async () => {
    prisma.slot.findMany.mockResolvedValue([
      {
        id: 's1', facilityId: 'f1', date: '2026-04-10', startTime: '06:00', endTime: '07:00',
        capacity: 2, priceOverride: null,
        _count: { bookings: 2 },
      },
    ]);

    const result = await FacilityService.getSlots(prisma, 'f1', '2026-04-10', false);
    expect(result[0].isAvailable).toBe(false);
  });

  it('marks slot as blocked by availability block', async () => {
    prisma.availabilityBlock.findMany.mockResolvedValue([
      { date: '2026-04-10', startTime: '05:00', endTime: '08:00', facilityId: 'f1' },
    ]);
    prisma.slot.findMany.mockResolvedValue([
      {
        id: 's1', facilityId: 'f1', date: '2026-04-10', startTime: '06:00', endTime: '07:00',
        capacity: 4, priceOverride: null,
        _count: { bookings: 0 },
      },
    ]);

    const result = await FacilityService.getSlots(prisma, 'f1', '2026-04-10', false);
    expect(result[0].isBlocked).toBe(true);
    expect(result[0].isAvailable).toBe(false);
  });

  it('marks all-day block (null start/end) as blocking all slots', async () => {
    prisma.availabilityBlock.findMany.mockResolvedValue([
      { date: '2026-04-10', startTime: null, endTime: null, facilityId: null },
    ]);
    prisma.slot.findMany.mockResolvedValue([
      {
        id: 's1', facilityId: 'f1', date: '2026-04-10', startTime: '06:00', endTime: '07:00',
        capacity: 4, priceOverride: null,
        _count: { bookings: 0 },
      },
    ]);

    const result = await FacilityService.getSlots(prisma, 'f1', '2026-04-10', false);
    expect(result[0].isBlocked).toBe(true);
  });

  it('uses priceOverride when present', async () => {
    prisma.slot.findMany.mockResolvedValue([
      {
        id: 's1', facilityId: 'f1', date: '2026-04-10', startTime: '06:00', endTime: '07:00',
        capacity: 4, priceOverride: 750,
        _count: { bookings: 0 },
      },
    ]);

    const result = await FacilityService.getSlots(prisma, 'f1', '2026-04-10', false);
    expect(result[0].effectivePrice).toBe(750);
  });

  it('filters to available-only when flag is true', async () => {
    prisma.slot.findMany.mockResolvedValue([
      {
        id: 's1', facilityId: 'f1', date: '2026-04-10', startTime: '06:00', endTime: '07:00',
        capacity: 4, priceOverride: null, _count: { bookings: 0 },
      },
      {
        id: 's2', facilityId: 'f1', date: '2026-04-10', startTime: '07:00', endTime: '08:00',
        capacity: 1, priceOverride: null, _count: { bookings: 1 },
      },
    ]);

    const result = await FacilityService.getSlots(prisma, 'f1', '2026-04-10', true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });

  it('throws 404 when facility not found', async () => {
    prisma.facility.findUnique.mockResolvedValue(null);

    await expect(
      FacilityService.getSlots(prisma, 'nonexistent', '2026-04-10', false),
    ).rejects.toThrow('Facility not found');
  });

  it('marks past slots as unavailable for today (IST)', async () => {
    // Get current IST time and construct a slot that is 2 hours in the past
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayIST = `${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, '0')}-${String(nowIST.getDate()).padStart(2, '0')}`;
    const pastHour = String(Math.max(0, nowIST.getHours() - 2)).padStart(2, '0');
    const futureHour = String(Math.min(23, nowIST.getHours() + 2)).padStart(2, '0');

    prisma.slot.findMany.mockResolvedValue([
      {
        id: 's-past', facilityId: 'f1', date: todayIST, startTime: `${pastHour}:00`, endTime: `${pastHour}:59`,
        capacity: 4, priceOverride: null, _count: { bookings: 0 },
      },
      {
        id: 's-future', facilityId: 'f1', date: todayIST, startTime: `${futureHour}:00`, endTime: `${futureHour}:59`,
        capacity: 4, priceOverride: null, _count: { bookings: 0 },
      },
    ]);

    const result = await FacilityService.getSlots(prisma, 'f1', todayIST, false);
    const pastSlot = result.find((s: any) => s.id === 's-past');
    const futureSlot = result.find((s: any) => s.id === 's-future');

    expect(pastSlot?.isAvailable).toBe(false);
    expect(futureSlot?.isAvailable).toBe(true);
  });

  it('does not filter past slots for future dates', async () => {
    prisma.slot.findMany.mockResolvedValue([
      {
        id: 's1', facilityId: 'f1', date: '2026-12-25', startTime: '06:00', endTime: '07:00',
        capacity: 4, priceOverride: null, _count: { bookings: 0 },
      },
    ]);

    const result = await FacilityService.getSlots(prisma, 'f1', '2026-12-25', false);
    expect(result[0].isAvailable).toBe(true);
  });
});

describe('FacilityService.create', () => {
  it('creates a facility with trimmed name', async () => {
    const prisma = createMockPrisma();
    prisma.facility.create.mockResolvedValue({ id: 'f1', name: 'Net 1', type: 'NET' });

    const result = await FacilityService.create(prisma, {
      name: '  Net 1  ',
      type: 'NET',
      pricePerSlot: 500,
    });
    expect(prisma.facility.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Net 1' }),
      }),
    );
  });
});

describe('FacilityService.update', () => {
  it('updates only provided fields', async () => {
    const prisma = createMockPrisma();
    prisma.facility.findUnique.mockResolvedValue({ id: 'f1' });
    prisma.facility.update.mockResolvedValue({ id: 'f1', name: 'Updated' });

    await FacilityService.update(prisma, 'f1', { name: 'Updated' });
    expect(prisma.facility.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Updated' }),
      }),
    );
  });

  it('throws 404 when facility not found', async () => {
    const prisma = createMockPrisma();
    prisma.facility.findUnique.mockResolvedValue(null);

    await expect(
      FacilityService.update(prisma, 'nonexistent', { name: 'X' }),
    ).rejects.toThrow('Facility not found');
  });
});
