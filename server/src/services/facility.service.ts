/**
 * FacilityService — facility and slot queries with availability calculation.
 */
import { PrismaClient } from '@prisma/client';

/** Throw an HTTP-aware error */
function httpError(message: string, statusCode: number): never {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  throw err;
}

export interface CreateFacilityInput {
  name: string;
  type: 'NET' | 'TURF';
  description?: string;
  pricePerSlot: number;
}

export interface UpdateFacilityInput {
  name?: string;
  type?: 'NET' | 'TURF';
  description?: string;
  pricePerSlot?: number;
  isActive?: boolean;
}

export const FacilityService = {
  async listActive(prisma: PrismaClient) {
    return prisma.facility.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  async getById(prisma: PrismaClient, id: string) {
    const facility = await prisma.facility.findUnique({ where: { id } });
    if (!facility) httpError('Facility not found', 404);
    return facility!;
  },

  /**
   * Get slots for a facility on a given date, enriched with availability info.
   * Also filters out slots blocked by AvailabilityBlock entries.
   */
  async getSlots(
    prisma: PrismaClient,
    facilityId: string,
    date: string,
    availableOnly: boolean,
  ) {
    // Verify facility exists
    const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
    if (!facility) httpError('Facility not found', 404);

    // Check for availability blocks on this date for this facility
    const blocks = await prisma.availabilityBlock.findMany({
      where: {
        date,
        OR: [{ facilityId }, { facilityId: null }],
      },
    });

    // Fetch slots with active booking counts
    const slots = await prisma.slot.findMany({
      where: { facilityId, date },
      orderBy: { startTime: 'asc' },
      include: {
        _count: {
          select: {
            bookings: {
              where: { status: { in: ['PENDING', 'CONFIRMED'] } },
            },
          },
        },
      },
    });

    // Current time in IST for filtering past slots
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayIST = `${nowIST.getFullYear()}-${String(nowIST.getMonth() + 1).padStart(2, '0')}-${String(nowIST.getDate()).padStart(2, '0')}`;
    const currentTimeHHMM = `${String(nowIST.getHours()).padStart(2, '0')}:${String(nowIST.getMinutes()).padStart(2, '0')}`;

    // Enrich slots with availability info
    const enriched = slots.map((slot: any) => {
      const bookedCount = slot._count.bookings;

      // Check if this slot is blocked
      const isBlocked = blocks.some((block: any) => {
        if (!block.startTime || !block.endTime) return true; // all-day block
        return slot.startTime >= block.startTime && slot.startTime < block.endTime;
      });

      // Slot is in the past if it's today and start time has passed
      const isPast = date === todayIST && slot.startTime <= currentTimeHHMM;

      const isAvailable = !isBlocked && !isPast && bookedCount < slot.capacity;

      return {
        id: slot.id,
        facilityId: slot.facilityId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        bookedCount,
        isAvailable,
        isBlocked,
        priceOverride: slot.priceOverride,
        effectivePrice: slot.priceOverride ?? facility!.pricePerSlot,
      };
    });

    if (availableOnly) {
      return enriched.filter((s: any) => s.isAvailable);
    }

    return enriched;
  },

  async create(prisma: PrismaClient, data: CreateFacilityInput) {
    return prisma.facility.create({
      data: {
        name: data.name.trim(),
        type: data.type,
        description: data.description?.trim() ?? '',
        pricePerSlot: data.pricePerSlot,
      },
    });
  },

  async update(prisma: PrismaClient, id: string, data: UpdateFacilityInput) {
    const facility = await prisma.facility.findUnique({ where: { id } });
    if (!facility) httpError('Facility not found', 404);

    return prisma.facility.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.description !== undefined && { description: data.description.trim() }),
        ...(data.pricePerSlot !== undefined && { pricePerSlot: data.pricePerSlot }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  },
};
