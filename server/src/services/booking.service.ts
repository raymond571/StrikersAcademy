/**
 * BookingService — slot reservation and booking lifecycle management.
 * All booking creation uses a Prisma interactive transaction to prevent race conditions.
 */
import { Prisma, PrismaClient } from '@prisma/client';

type TxClient = Prisma.TransactionClient;
import { PaymentService } from './payment.service';
import { SettingsService } from './settings.service';

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

export interface BatchBookingInput {
  userId: string;
  slotIds: string[];
  bookingFor: 'SELF' | 'CHILD' | 'TEAM';
  playerName?: string;
  teamName?: string;
  paymentMethod: 'ONLINE' | 'OFFLINE';
  notes?: string;
}

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED'];

// Cancellation/update cutoff: 25 minutes before slot start
const CANCEL_CUTOFF_MS = 25 * 60 * 1000;

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

    return prisma.$transaction(async (tx: TxClient) => {
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

      const isBlocked = blocks.some((block: any) => {
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

  /**
   * Create multiple bookings in a single transaction (multi-slot / multi-facility).
   * All bookings share the same batchId. One payment record per booking.
   * For ONLINE: first booking gets the Razorpay payment, rest are linked via batchId.
   */
  async createBatchBooking(prisma: PrismaClient, data: BatchBookingInput) {
    if (!data.slotIds.length) httpError('At least one slot is required', 400);
    if (data.bookingFor === 'CHILD' && !data.playerName) {
      httpError('playerName is required when booking for a child', 400);
    }
    if (data.bookingFor === 'TEAM' && !data.teamName) {
      httpError('teamName is required when booking for a team', 400);
    }

    // Deduplicate slot IDs
    const uniqueSlotIds = [...new Set(data.slotIds)];

    return prisma.$transaction(async (tx: TxClient) => {
      // Fetch all slots with facilities
      const slots = await tx.slot.findMany({
        where: { id: { in: uniqueSlotIds } },
        include: { facility: true },
      });

      if (slots.length !== uniqueSlotIds.length) {
        const foundIds = slots.map((s: any) => s.id);
        const missing = uniqueSlotIds.filter((id) => !foundIds.includes(id));
        httpError(`Slots not found: ${missing.join(', ')}`, 404);
      }

      // Validate all slots
      let totalPrice = 0;
      for (const slot of slots) {
        if (!(slot as any).facility.isActive) {
          httpError(`Facility "${(slot as any).facility.name}" is currently inactive`, 400);
        }

        // Check blocks
        const blocks = await tx.availabilityBlock.findMany({
          where: {
            date: slot.date,
            OR: [{ facilityId: slot.facilityId }, { facilityId: null }],
          },
        });
        const isBlocked = blocks.some((block: any) => {
          if (!block.startTime || !block.endTime) return true;
          return slot.startTime >= block.startTime && slot.startTime < block.endTime;
        });
        if (isBlocked) {
          httpError(`Slot ${slot.startTime}-${slot.endTime} on ${slot.date} is blocked`, 400);
        }

        // Check capacity
        const activeCount = await tx.booking.count({
          where: { slotId: slot.id, status: { in: ACTIVE_STATUSES } },
        });
        if (activeCount >= slot.capacity) {
          httpError(`Slot ${slot.startTime}-${slot.endTime} at ${(slot as any).facility.name} is fully booked`, 409);
        }

        // Check duplicate
        const existing = await tx.booking.findFirst({
          where: { userId: data.userId, slotId: slot.id, status: { in: ACTIVE_STATUSES } },
        });
        if (existing) {
          httpError(`You already have a booking for ${slot.startTime}-${slot.endTime} at ${(slot as any).facility.name}`, 409);
        }

        totalPrice += slot.priceOverride ?? (slot as any).facility.pricePerSlot;
      }

      // Generate a batch ID to group these bookings
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Create all bookings
      const bookings = [];
      for (const slot of slots) {
        const effectivePrice = slot.priceOverride ?? (slot as any).facility.pricePerSlot;
        const booking = await tx.booking.create({
          data: {
            userId: data.userId,
            slotId: slot.id,
            batchId,
            status: data.paymentMethod === 'OFFLINE' ? 'CONFIRMED' : 'PENDING',
            bookingFor: data.bookingFor,
            playerName: data.playerName?.trim(),
            teamName: data.teamName?.trim(),
            paymentMethod: data.paymentMethod,
            notes: data.notes?.trim(),
          },
          include: { slot: { include: { facility: true } } },
        });

        // Each booking gets its own payment record
        await tx.payment.create({
          data: {
            bookingId: booking.id,
            amount: effectivePrice,
            method: data.paymentMethod,
            status: 'PENDING',
          },
        });

        bookings.push({ ...booking, effectivePrice });
      }

      return { bookings, batchId, totalPrice };
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

  /**
   * Update a booking's slot (reschedule). Frees old slot, checks new slot capacity, recalculates price.
   * Handles payment adjustments:
   *  - Price DOWN + online paid → partial Razorpay refund for the difference
   *  - Price UP + extraPaymentMethod 'ONLINE' → creates Razorpay order for the difference
   *  - Price UP + extraPaymentMethod 'OFFLINE' → notes the extra owed at venue
   */
  async updateSlot(
    prisma: PrismaClient,
    bookingId: string,
    newSlotId: string,
    userId: string,
    userRole: string,
    extraPaymentMethod?: 'ONLINE' | 'OFFLINE',
  ) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slot: { include: { facility: true } }, payment: true },
    });

    if (!booking) httpError('Booking not found', 404);
    if (booking!.userId !== userId && userRole !== 'ADMIN' && userRole !== 'STAFF') {
      httpError('You do not have access to this booking', 403);
    }
    if (!ACTIVE_STATUSES.includes(booking!.status)) {
      httpError('Only PENDING or CONFIRMED bookings can be updated', 400);
    }
    if (booking!.slotId === newSlotId) {
      httpError('New slot is the same as the current slot', 400);
    }

    // Check update cutoff (admin/staff can update anytime)
    if (userRole === 'CUSTOMER') {
      const slotDateTime = new Date(`${booking!.slot.date}T${booking!.slot.startTime}:00`);
      const now = new Date();
      if (slotDateTime.getTime() - now.getTime() < CANCEL_CUTOFF_MS) {
        httpError('Changes are only allowed at least 25 minutes before the slot start time', 400);
      }
    }

    // Pre-transaction: validate new slot
    const newSlot = await prisma.slot.findUnique({
      where: { id: newSlotId },
      include: { facility: true },
    });
    if (!newSlot) httpError('New slot not found', 404);
    if (!newSlot!.facility.isActive) httpError('Target facility is currently inactive', 400);

    const oldPrice = booking!.payment?.amount ?? 0;
    const newPrice = newSlot!.priceOverride ?? newSlot!.facility.pricePerSlot;
    const priceDiff = newPrice - oldPrice;
    const wasPaidOnline = booking!.payment?.status === 'SUCCESS' && booking!.payment?.razorpayPaymentId;

    // If price went up, extraPaymentMethod is required
    if (priceDiff > 0 && !extraPaymentMethod) {
      httpError('extraPaymentMethod is required when the new slot costs more', 400);
    }

    // If price went up and they want to pay extra online, create Razorpay order BEFORE transaction
    let razorpayOrder: { id: string } | null = null;
    if (priceDiff > 0 && extraPaymentMethod === 'ONLINE') {
      try {
        razorpayOrder = await PaymentService.createOrder(priceDiff, `${bookingId}-extra`);
      } catch (err: any) {
        const msg = err?.error?.description || err?.message || 'Razorpay order creation failed';
        httpError(`Payment gateway error: ${msg}`, 502);
      }
    }

    // If price went down and was paid online, issue partial refund BEFORE transaction
    if (priceDiff < 0 && wasPaidOnline) {
      try {
        await PaymentService.refund(booking!.payment!.razorpayPaymentId!, Math.abs(priceDiff));
      } catch (err: unknown) {
        const msg = (err as { error?: { description?: string } })?.error?.description
          || (err as Error)?.message || 'Razorpay partial refund failed';
        httpError(`Refund failed: ${msg}`, 502);
      }
    }

    const result = await prisma.$transaction(async (tx: TxClient) => {
      // Check availability blocks on new slot
      const blocks = await tx.availabilityBlock.findMany({
        where: {
          date: newSlot!.date,
          OR: [{ facilityId: newSlot!.facilityId }, { facilityId: null }],
        },
      });
      const isBlocked = blocks.some((block: any) => {
        if (!block.startTime || !block.endTime) return true;
        return newSlot!.startTime >= block.startTime && newSlot!.startTime < block.endTime;
      });
      if (isBlocked) httpError('The new slot is blocked and not available', 400);

      // Check capacity on new slot (exclude current booking from count)
      const activeBookings = await tx.booking.count({
        where: {
          slotId: newSlotId,
          status: { in: ACTIVE_STATUSES },
          id: { not: bookingId },
        },
      });
      if (activeBookings >= newSlot!.capacity) {
        httpError('The new slot is fully booked', 409);
      }

      // Check duplicate booking by same user on new slot
      const duplicate = await tx.booking.findFirst({
        where: {
          userId: booking!.userId,
          slotId: newSlotId,
          status: { in: ACTIVE_STATUSES },
          id: { not: bookingId },
        },
      });
      if (duplicate) {
        httpError('You already have an active booking for the new slot', 409);
      }

      // Update booking to new slot
      await tx.booking.update({
        where: { id: bookingId },
        data: { slotId: newSlotId },
      });

      // Update payment
      if (booking!.payment) {
        const paymentUpdate: Record<string, unknown> = { amount: newPrice };

        if (priceDiff > 0 && extraPaymentMethod === 'ONLINE' && razorpayOrder) {
          // Store the extra payment order — booking stays CONFIRMED, payment needs extra collection
          paymentUpdate.razorpayOrderId = razorpayOrder.id;
        }

        await tx.payment.update({
          where: { id: booking!.payment.id },
          data: paymentUpdate,
        });
      }

      // Re-fetch to get updated state
      return tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          slot: { include: { facility: true } },
          payment: true,
        },
      });
    });

    return {
      ...result!,
      newPrice,
      oldPrice,
      priceDiff,
      // If extra online payment needed, include Razorpay order details for frontend
      ...(razorpayOrder ? {
        extraPayment: {
          razorpayOrderId: razorpayOrder.id,
          amount: priceDiff,
          currency: 'INR',
          keyId: process.env.RAZORPAY_KEY_ID,
        },
      } : {}),
      // If partial refund was issued
      ...(priceDiff < 0 && wasPaidOnline ? {
        refundedAmount: Math.abs(priceDiff),
      } : {}),
    };
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
          'Changes are only allowed at least 25 minutes before the slot start time',
          400,
        );
      }
    }

    // Get cancellation charge percentage
    const chargePercent = await SettingsService.getCancellationChargePercent(prisma);

    // Cancel booking and process refund if applicable
    return prisma.$transaction(async (tx: TxClient) => {
      const payment = booking!.payment;
      const needsRefund = payment && payment.status === 'SUCCESS' && payment.razorpayPaymentId;
      let refundIssued = false;
      let cancellationCharge = 0;
      let refundAmount = 0;

      if (needsRefund) {
        // Calculate cancellation charge
        cancellationCharge = Math.round(payment.amount * chargePercent / 100);
        const refundableAmount = payment.amount - cancellationCharge;

        try {
          const rzpPayment = await PaymentService.fetchPayment(payment.razorpayPaymentId!);
          const alreadyRefunded = rzpPayment.amount_refunded ?? 0;
          const captured = rzpPayment.amount ?? 0;
          const remaining = captured - alreadyRefunded;

          // Only refund refundable amount (after charge), capped at what Razorpay has remaining
          const toRefund = Math.min(refundableAmount, remaining);

          if (toRefund > 0) {
            await PaymentService.refund(payment.razorpayPaymentId!, toRefund);
            refundAmount = toRefund;
          }
          refundIssued = true;
        } catch (err: unknown) {
          const msg = (err as { error?: { description?: string } })?.error?.description
            || (err as Error)?.message || 'Razorpay refund failed';
          if (msg.toLowerCase().includes('fully refunded')) {
            refundIssued = true;
          } else {
            httpError(`Refund failed: ${msg}`, 502);
          }
        }

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'REFUNDED',
            refundedAt: new Date(),
            cancellationCharge: cancellationCharge > 0 ? cancellationCharge : null,
            refundAmount: refundAmount > 0 ? refundAmount : null,
          },
        });
      }

      // Set booking to REFUNDED if refund was processed, otherwise CANCELLED
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: refundIssued ? 'REFUNDED' : 'CANCELLED' },
        include: {
          slot: { include: { facility: true } },
          payment: true,
        },
      });

      return updated;
    });
  },
};
