/**
 * BookingService — slot reservation and booking lifecycle management.
 * All booking creation uses a Prisma interactive transaction to prevent race conditions.
 */
import { PrismaClient } from '@prisma/client';

/** Throw an HTTP-aware error */
function httpError(message: string, statusCode: number): never {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  throw err;
}

export interface CreateBookingInput {
  userId: string;
  slotId: string;
  bookingFor: 'SELF' | 'CHILD' | 'TEAM';
  playerName?: string;
  teamName?: string;
  paymentMethod: 'ONLINE' | 'OFFLINE';
  notes?: string;
}

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED'];

// Cancellation cutoff: 2 hours before slot start
const CANCEL_CUTOFF_MS = 2 * 60 * 60 * 1000;

export const BookingService = {
  /**
   * Create a booking inside a transaction with capacity check.
   * Returns the created booking with slot + facility info.
   */
  async createBooking(prisma: PrismaClient, data: CreateBookingInput) {
    // Validate bookingFor-specific fields
    if (data.bookingFor === 'CHILD' && !data.playerName) {
      httpError('playerName is required when booking for a child', 400);
    }
    if (data.bookingFor === 'TEAM' && !data.teamName) {
      httpError('teamName is required when booking for a team', 400);
    }

    return prisma.$transaction(async (tx) => {
      // Fetch slot with facility (lock row via transaction)
      const slot = await tx.slot.findUnique({
        where: { id: data.slotId },
        include: { facility: true },
      });

      if (!slot) httpError('Slot not found', 404);
      if (!slot!.facility.isActive) httpError('This facility is currently inactive', 400);

      // Check availability blocks
      const blocks = await tx.availabilityBlock.findMany({
        where: {
          date: slot!.date,
          OR: [{ facilityId: slot!.facilityId }, { facilityId: null }],
        },
      });

      const isBlocked = blocks.some((block) => {
        if (!block.startTime || !block.endTime) return true;
        return slot!.startTime >= block.startTime && slot!.startTime < block.endTime;
      });

      if (isBlocked) httpError('This slot is blocked and not available for booking', 400);

      // Count active bookings for capacity check
      const activeBookings = await tx.booking.count({
        where: {
          slotId: data.slotId,
          status: { in: ACTIVE_STATUSES },
        },
      });

      if (activeBookings >= slot!.capacity) {
        httpError('This slot is fully booked', 409);
      }

      // Prevent duplicate booking by same user on same slot
      const existingBooking = await tx.booking.findFirst({
        where: {
          userId: data.userId,
          slotId: data.slotId,
          status: { in: ACTIVE_STATUSES },
        },
      });

      if (existingBooking) {
        httpError('You already have an active booking for this slot', 409);
      }

      // Create booking
      const booking = await tx.booking.create({
        data: {
          userId: data.userId,
          slotId: data.slotId,
          status: data.paymentMethod === 'OFFLINE' ? 'CONFIRMED' : 'PENDING',
          bookingFor: data.bookingFor,
          playerName: data.playerName?.trim(),
          teamName: data.teamName?.trim(),
          paymentMethod: data.paymentMethod,
          notes: data.notes?.trim(),
        },
        include: {
          slot: { include: { facility: true } },
        },
      });

      // Calculate final amount
      const effectivePrice = slot!.priceOverride ?? slot!.facility.pricePerSlot;

      // Create payment record
      if (data.paymentMethod === 'ONLINE') {
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            amount: effectivePrice,
            method: 'ONLINE',
            status: 'PENDING',
          },
        });
      } else {
        // Offline — mark payment as pending (collected at venue)
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            amount: effectivePrice,
            method: 'OFFLINE',
            status: 'PENDING',
          },
        });
      }

      return {
        ...booking,
        effectivePrice,
      };
    });
  },

  /** List bookings for a user with pagination */
  async listByUser(
    prisma: PrismaClient,
    userId: string,
    page: number,
    limit: number,
  ) {
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          slot: { include: { facility: true } },
          payment: true,
        },
      }),
      prisma.booking.count({ where: { userId } }),
    ]);

    return { bookings, total };
  },

  /** Get a single booking by ID, verifying ownership or admin role */
  async getById(
    prisma: PrismaClient,
    bookingId: string,
    userId: string,
    userRole: string,
  ) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        slot: { include: { facility: true } },
        payment: true,
      },
    });

    if (!booking) httpError('Booking not found', 404);

    if (booking!.userId !== userId && userRole !== 'ADMIN' && userRole !== 'STAFF') {
      httpError('You do not have access to this booking', 403);
    }

    return booking!;
  },

  /** Cancel a booking if within the cancellation window */
  async cancelBooking(
    prisma: PrismaClient,
    bookingId: string,
    userId: string,
    userRole: string,
  ) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slot: true, payment: true },
    });

    if (!booking) httpError('Booking not found', 404);

    if (booking!.userId !== userId && userRole !== 'ADMIN' && userRole !== 'STAFF') {
      httpError('You do not have access to this booking', 403);
    }

    if (booking!.status === 'CANCELLED' || booking!.status === 'REFUNDED') {
      httpError('This booking is already cancelled', 400);
    }

    // Check cancellation window (admin/staff can cancel anytime)
    if (userRole === 'CUSTOMER') {
      const slotDateTime = new Date(`${booking!.slot.date}T${booking!.slot.startTime}:00`);
      const now = new Date();
      if (slotDateTime.getTime() - now.getTime() < CANCEL_CUTOFF_MS) {
        httpError(
          'Cancellation is only allowed at least 2 hours before the slot start time',
          400,
        );
      }
    }

    // Cancel booking and update payment status
    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
        include: {
          slot: { include: { facility: true } },
          payment: true,
        },
      });

      // Mark payment for refund if it was paid online
      if (updated.payment && updated.payment.status === 'SUCCESS') {
        await tx.payment.update({
          where: { id: updated.payment.id },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        });
      }

      return updated;
    });
  },
};
