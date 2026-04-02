/**
 * BookingService — slot reservation and booking lifecycle management.
 */
import { PrismaClient } from '@prisma/client';

export const BookingService = {
  async createBooking(
    prisma: PrismaClient,
    data: { userId: string; slotId: string },
  ) {
    // TODO:
    // 1. Check slot.isAvailable in a transaction
    // 2. Set slot.isAvailable = false
    // 3. Create Booking with status PENDING
    // 4. Return booking
    throw new Error('Not implemented');
  },

  async cancelBooking(
    prisma: PrismaClient,
    data: { bookingId: string; userId: string },
  ) {
    // TODO:
    // 1. Find booking, verify ownership
    // 2. Check cancellation eligibility (e.g. >2h before slot)
    // 3. Set booking.status = CANCELLED
    // 4. Set slot.isAvailable = true
    // 5. Trigger refund if payment was captured
    throw new Error('Not implemented');
  },
};
