/**
 * AdminService — business logic for admin panel operations.
 * Dashboard stats, booking management, user listing, slot operations, revenue reports, coupons.
 */
import { Prisma, PrismaClient } from '@prisma/client';

type TxClient = Prisma.TransactionClient;
import { PaymentService } from './payment.service';
import { EmailService } from './email.service';
import { hashPassword } from '../utils/password';

function httpError(message: string, statusCode: number): never {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  throw err;
}

// ── Types ────────────────────────────────────────────────────

export interface ListBookingsQuery {
  status?: string;
  date?: string;
  facilityId?: string;
  page: number;
  limit: number;
}

export interface ManualBookingInput {
  userId: string;
  slotId: string;
  bookingFor: 'SELF' | 'CHILD' | 'TEAM';
  playerName?: string;
  teamName?: string;
  paymentMethod: 'ONLINE' | 'OFFLINE';
  notes?: string;
  createdById: string;
}

export interface BulkSlotsInput {
  facilityId: string;
  startDate: string;
  endDate: string;
  timeSlots: { startTime: string; endTime: string }[];
  capacity?: number;
}

export interface BlockSlotsInput {
  facilityId?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  reason: string;
  createdById: string;
}

export interface RevenueQuery {
  from: string;
  to: string;
}

export interface CreateCouponInput {
  code: string;
  description?: string;
  discountType: 'FIXED' | 'PERCENT';
  discountValue: number;
  maxUsage?: number;
  validFrom: string;
  validUntil?: string;
}

export interface UpdateCouponInput {
  description?: string;
  discountValue?: number;
  maxUsage?: number;
  validUntil?: string | null;
  isActive?: boolean;
}

// ── Service ──────────────────────────────────────────────────

export const AdminService = {
  /** Dashboard summary stats */
  async dashboard(prisma: PrismaClient) {
    const [totalBookings, confirmedBookings, activeFacilities, totalUsers, revenueResult, refundResult] =
      await Promise.all([
        prisma.booking.count(),
        prisma.booking.count({ where: { status: 'CONFIRMED' } }),
        prisma.facility.count({ where: { isActive: true } }),
        prisma.user.count({ where: { role: 'CUSTOMER' } }),
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: 'SUCCESS' },
        }),
        prisma.payment.aggregate({
          _sum: { amount: true },
          _count: true,
          where: { status: 'REFUNDED' },
        }),
      ]);

    // Today's bookings
    const today = new Date().toISOString().slice(0, 10);
    const todayBookings = await prisma.booking.count({
      where: {
        slot: { date: today },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    const gross = revenueResult._sum.amount ?? 0;
    const refunds = refundResult._sum.amount ?? 0;

    return {
      totalBookings,
      confirmedBookings,
      todayBookings,
      activeFacilities,
      totalUsers,
      totalRevenue: gross,
      totalRefunds: refunds,
      netRevenue: gross - refunds,
    };
  },

  /** List all bookings with filters and pagination */
  async listBookings(prisma: PrismaClient, query: ListBookingsQuery) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.date) where.slot = { date: query.date };
    if (query.facilityId) where.slot = { ...((where.slot as object) || {}), facilityId: query.facilityId };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
          slot: { include: { facility: true } },
          payment: true,
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  },

  /** Admin/staff creates a manual booking */
  async createManualBooking(prisma: PrismaClient, data: ManualBookingInput) {
    // Validate bookingFor fields
    if (data.bookingFor === 'CHILD' && !data.playerName) {
      httpError('playerName is required when booking for a child', 400);
    }
    if (data.bookingFor === 'TEAM' && !data.teamName) {
      httpError('teamName is required when booking for a team', 400);
    }

    return prisma.$transaction(async (tx: TxClient) => {
      // Verify user exists
      const user = await tx.user.findUnique({ where: { id: data.userId } });
      if (!user) httpError('User not found', 404);

      // Fetch slot with facility
      const slot = await tx.slot.findUnique({
        where: { id: data.slotId },
        include: { facility: true },
      });
      if (!slot) httpError('Slot not found', 404);

      // Capacity check
      const activeCount = await tx.booking.count({
        where: { slotId: data.slotId, status: { in: ['PENDING', 'CONFIRMED'] } },
      });
      if (activeCount >= slot!.capacity) httpError('Slot is fully booked', 409);

      const effectivePrice = slot!.priceOverride ?? slot!.facility.pricePerSlot;

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
          createdById: data.createdById,
        },
        include: {
          user: { select: { id: true, name: true, phone: true } },
          slot: { include: { facility: true } },
        },
      });

      await tx.payment.create({
        data: {
          bookingId: booking.id,
          amount: effectivePrice,
          method: data.paymentMethod,
          status: data.paymentMethod === 'OFFLINE' ? 'PENDING' : 'PENDING',
        },
      });

      return booking;
    });
  },

  /** Update booking status (approve/reject/cancel/refund) */
  async updateBookingStatus(
    prisma: PrismaClient,
    bookingId: string,
    status: string,
    notes?: string,
  ) {
    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED'];
    if (!validStatuses.includes(status)) {
      httpError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) httpError('Booking not found', 404);

    const statusResult = await prisma.$transaction(async (tx: TxClient) => {
      const payment = booking!.payment;

      // Handle payment status changes — issue Razorpay refund if applicable
      if (status === 'REFUNDED' && payment && payment.status === 'SUCCESS') {
        if (payment.razorpayPaymentId) {
          try {
            // Check how much has already been refunded (partial refunds from reschedule)
            const rzpPayment = await PaymentService.fetchPayment(payment.razorpayPaymentId);
            const remaining = (rzpPayment.amount ?? 0) - (rzpPayment.amount_refunded ?? 0);
            if (remaining > 0) {
              await PaymentService.refund(payment.razorpayPaymentId, remaining);
            }
          } catch (err: unknown) {
            const msg = (err as { error?: { description?: string } })?.error?.description
              || (err as Error)?.message || 'Razorpay refund failed';
            if (!msg.toLowerCase().includes('fully refunded')) {
              httpError(`Refund failed: ${msg}`, 502);
            }
          }
        }
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        });
      }
      if (status === 'CANCELLED' && payment) {
        if (payment.status === 'PENDING') {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: 'FAILED' },
          });
        }
        // For SUCCESS payments cancelled without refund, mark payment as FAILED
        // so revenue no longer counts it
        if (payment.status === 'SUCCESS' && !payment.razorpayPaymentId) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: 'FAILED' },
          });
        }
      }

      // Update booking status after payment changes so return value is fresh
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status,
          ...(notes !== undefined ? { notes } : {}),
        },
        include: {
          user: { select: { id: true, name: true, phone: true } },
          slot: { include: { facility: true } },
          payment: true,
        },
      });

      return updated;
    });

    // Send email notification for cancel/refund (async)
    if (status === 'CANCELLED' || status === 'REFUNDED') {
      EmailService.sendCancellationEmail(prisma, bookingId).catch(() => {});
    }

    return statusResult;
  },

  /** Mark an offline booking as paid */
  async markAsPaid(prisma: PrismaClient, bookingId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) httpError('Booking not found', 404);
    if (booking!.paymentMethod !== 'OFFLINE') httpError('Only offline bookings can be marked as paid', 400);
    if (booking!.payment?.status === 'SUCCESS') httpError('Already marked as paid', 400);

    return prisma.$transaction(async (tx: TxClient) => {
      if (booking!.payment) {
        await tx.payment.update({
          where: { id: booking!.payment.id },
          data: { status: 'SUCCESS', paidAt: new Date() },
        });
      }
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED' },
        include: {
          user: { select: { id: true, name: true, phone: true } },
          slot: { include: { facility: true } },
          payment: true,
        },
      });
      return updated;
    });
  },

  /** List all users with pagination */
  async listUsers(prisma: PrismaClient, page: number, limit: number) {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          age: true,
          role: true,
          createdAt: true,
          _count: { select: { bookings: true } },
        },
      }),
      prisma.user.count(),
    ]);

    return { users, total };
  },

  /** Create a user (admin can set role) */
  async createUser(prisma: PrismaClient, data: {
    name: string; email: string; phone: string; dateOfBirth: string; password: string; role: string;
  }) {
    const existingPhone = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (existingPhone) httpError('Phone number already registered', 409);

    const existingEmail = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
    if (existingEmail) httpError('Email already registered', 409);

    // Calculate age from DOB
    const birth = new Date(data.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const md = today.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;

    const hashed = await hashPassword(data.password);
    return prisma.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        phone: data.phone,
        age,
        dateOfBirth: data.dateOfBirth,
        password: hashed,
        role: data.role,
      },
      select: { id: true, name: true, email: true, phone: true, age: true, dateOfBirth: true, role: true, createdAt: true },
    });
  },

  /** Update a user (name, email, age, role) */
  async updateUser(prisma: PrismaClient, userId: string, data: {
    name?: string; email?: string; age?: number; role?: string; password?: string;
  }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) httpError('User not found', 404);

    // Check email uniqueness if changing
    if (data.email && data.email.toLowerCase().trim() !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
      if (existing) httpError('Email already in use', 409);
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.email !== undefined) updateData.email = data.email.toLowerCase().trim();
    if (data.age !== undefined) updateData.age = data.age;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.password) updateData.password = await hashPassword(data.password);

    return prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, name: true, email: true, phone: true, age: true, role: true, createdAt: true },
    });
  },

  /** Delete a user (only if they have no bookings) */
  async deleteUser(prisma: PrismaClient, userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { _count: { select: { bookings: true } } } });
    if (!user) httpError('User not found', 404);
    if (user._count.bookings > 0) httpError(`Cannot delete — user has ${user._count.bookings} booking(s). Cancel them first.`, 400);

    await prisma.user.delete({ where: { id: userId } });
    return { id: user.id, name: user.name };
  },

  /** Bulk-create slots for a facility over a date range */
  async bulkCreateSlots(prisma: PrismaClient, data: BulkSlotsInput) {
    // Validate facility exists
    const facility = await prisma.facility.findUnique({ where: { id: data.facilityId } });
    if (!facility) httpError('Facility not found', 404);

    // Generate dates
    const dates: string[] = [];
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (start > end) httpError('startDate must be before or equal to endDate', 400);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }

    const capacity = data.capacity ?? 1;

    // Create slots, skipping duplicates
    let created = 0;
    let skipped = 0;

    for (const date of dates) {
      for (const ts of data.timeSlots) {
        try {
          await prisma.slot.create({
            data: {
              facilityId: data.facilityId,
              date,
              startTime: ts.startTime,
              endTime: ts.endTime,
              capacity,
            },
          });
          created++;
        } catch (err: unknown) {
          // Unique constraint violation — slot already exists
          if ((err as { code?: string }).code === 'P2002') {
            skipped++;
          } else {
            throw err;
          }
        }
      }
    }

    return { created, skipped, totalDates: dates.length, totalTimeSlots: data.timeSlots.length };
  },

  /** Block slots for rain/holiday/maintenance */
  async blockSlots(prisma: PrismaClient, data: BlockSlotsInput) {
    const block = await prisma.availabilityBlock.create({
      data: {
        facilityId: data.facilityId || null,
        date: data.date,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        reason: data.reason,
        createdById: data.createdById,
      },
    });
    return block;
  },

  /** Remove a slot block */
  async removeBlock(prisma: PrismaClient, blockId: string) {
    const block = await prisma.availabilityBlock.findUnique({ where: { id: blockId } });
    if (!block) httpError('Block not found', 404);

    await prisma.availabilityBlock.delete({ where: { id: blockId } });
    return block;
  },

  /** Revenue report — daily breakdown between two dates, including refund data */
  async revenueReport(prisma: PrismaClient, query: RevenueQuery) {
    const [successPayments, refundedPayments] = await Promise.all([
      prisma.payment.findMany({
        where: {
          status: 'SUCCESS',
          paidAt: { gte: new Date(`${query.from}T00:00:00Z`), lte: new Date(`${query.to}T23:59:59Z`) },
        },
        include: { booking: { include: { slot: { include: { facility: true } } } } },
        orderBy: { paidAt: 'asc' },
      }),
      prisma.payment.findMany({
        where: {
          status: 'REFUNDED',
          refundedAt: { gte: new Date(`${query.from}T00:00:00Z`), lte: new Date(`${query.to}T23:59:59Z`) },
        },
        include: { booking: { include: { slot: { include: { facility: true } } } } },
        orderBy: { refundedAt: 'asc' },
      }),
    ]);

    // Group successful payments by date
    const dailyMap = new Map<string, { revenue: number; count: number; online: number; offline: number; refunds: number; refundCount: number }>();

    for (const p of successPayments) {
      const date = p.paidAt ? p.paidAt.toISOString().slice(0, 10) : p.booking.slot.date;
      const entry = dailyMap.get(date) ?? { revenue: 0, count: 0, online: 0, offline: 0, refunds: 0, refundCount: 0 };
      entry.revenue += p.amount;
      entry.count += 1;
      if (p.method === 'ONLINE') entry.online += p.amount;
      else entry.offline += p.amount;
      dailyMap.set(date, entry);
    }

    // Add refunds to daily map
    for (const p of refundedPayments) {
      const date = p.refundedAt ? p.refundedAt.toISOString().slice(0, 10) : p.booking.slot.date;
      const entry = dailyMap.get(date) ?? { revenue: 0, count: 0, online: 0, offline: 0, refunds: 0, refundCount: 0 };
      entry.refunds += p.amount;
      entry.refundCount += 1;
      dailyMap.set(date, entry);
    }

    const daily = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalRevenue = successPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const totalOnline = successPayments.filter((p: any) => p.method === 'ONLINE').reduce((sum: number, p: any) => sum + p.amount, 0);
    const totalOffline = totalRevenue - totalOnline;
    const totalRefunds = refundedPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const netRevenue = totalRevenue - totalRefunds;

    return {
      from: query.from,
      to: query.to,
      totalRevenue,
      netRevenue,
      totalOnline,
      totalOffline,
      totalRefunds,
      totalRefundCount: refundedPayments.length,
      totalPayments: successPayments.length,
      daily,
    };
  },

  /** Fetch Razorpay payment details for cross-verification */
  async razorpayVerify(prisma: PrismaClient, paymentId: string) {
    const payment = await prisma.payment.findFirst({
      where: { OR: [{ id: paymentId }, { razorpayPaymentId: paymentId }] },
      include: { booking: { include: { slot: { include: { facility: true } }, user: { select: { id: true, name: true, phone: true } } } } },
    });
    if (!payment) httpError('Payment not found', 404);
    if (!payment!.razorpayPaymentId) httpError('No Razorpay payment ID — this may be an offline payment', 400);

    let razorpayData: any = null;
    try {
      razorpayData = await PaymentService.fetchPayment(payment!.razorpayPaymentId!);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to fetch from Razorpay';
      httpError(`Razorpay API error: ${msg}`, 502);
    }

    return {
      local: {
        id: payment!.id,
        status: payment!.status,
        amount: payment!.amount,
        method: payment!.method,
        razorpayPaymentId: payment!.razorpayPaymentId,
        razorpayOrderId: payment!.razorpayOrderId,
        paidAt: payment!.paidAt,
        refundedAt: payment!.refundedAt,
        booking: payment!.booking,
      },
      razorpay: {
        id: razorpayData.id,
        status: razorpayData.status,
        amount: razorpayData.amount,
        currency: razorpayData.currency,
        method: razorpayData.method,
        captured: razorpayData.captured,
        refundStatus: razorpayData.refund_status,
        amountRefunded: razorpayData.amount_refunded,
        createdAt: razorpayData.created_at ? new Date(razorpayData.created_at * 1000).toISOString() : null,
      },
    };
  },

  /** List all coupons */
  async listCoupons(prisma: PrismaClient) {
    return prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  },

  /** Create a coupon */
  async createCoupon(prisma: PrismaClient, data: CreateCouponInput) {
    // Check unique code
    const existing = await prisma.coupon.findUnique({ where: { code: data.code.toUpperCase() } });
    if (existing) httpError('Coupon code already exists', 409);

    return prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        description: data.description ?? '',
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxUsage: data.maxUsage ?? null,
        validFrom: new Date(data.validFrom),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
      },
    });
  },

  /** Update/deactivate a coupon */
  async updateCoupon(prisma: PrismaClient, couponId: string, data: UpdateCouponInput) {
    const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) httpError('Coupon not found', 404);

    return prisma.coupon.update({
      where: { id: couponId },
      data: {
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.discountValue !== undefined ? { discountValue: data.discountValue } : {}),
        ...(data.maxUsage !== undefined ? { maxUsage: data.maxUsage } : {}),
        ...(data.validUntil !== undefined ? { validUntil: data.validUntil ? new Date(data.validUntil) : null } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  },

  // ── Facility Types ─────────────────────────────────────────

  /** List all facility types */
  async listFacilityTypes(prisma: PrismaClient) {
    return prisma.facilityType.findMany({ orderBy: { name: 'asc' } });
  },

  /** Create a facility type */
  async createFacilityType(prisma: PrismaClient, data: { name: string; label: string; description?: string }) {
    const existing = await prisma.facilityType.findUnique({ where: { name: data.name.toUpperCase() } });
    if (existing) httpError('Facility type already exists', 409);

    return prisma.facilityType.create({
      data: {
        name: data.name.toUpperCase(),
        label: data.label,
        description: data.description ?? '',
      },
    });
  },

  /** Update a facility type */
  async updateFacilityType(prisma: PrismaClient, id: string, data: { label?: string; description?: string; isActive?: boolean }) {
    const ft = await prisma.facilityType.findUnique({ where: { id } });
    if (!ft) httpError('Facility type not found', 404);

    return prisma.facilityType.update({
      where: { id },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  },

  /** Delete a facility type (only if no facilities use it) */
  async deleteFacilityType(prisma: PrismaClient, id: string) {
    const ft = await prisma.facilityType.findUnique({ where: { id } });
    if (!ft) httpError('Facility type not found', 404);

    const usedCount = await prisma.facility.count({ where: { type: ft.name } });
    if (usedCount > 0) httpError(`Cannot delete — ${usedCount} facility(ies) use this type`, 400);

    await prisma.facilityType.delete({ where: { id } });
    return ft;
  },
};
