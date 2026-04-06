/**
 * API service layer — wraps all HTTP calls to the Fastify backend.
 * Uses axios with credentials (for httpOnly cookie auth).
 */
import axios from 'axios';
import type {
  User,
  AuthResponse,
  Booking,
  Facility,
  Slot,
  Coupon,
  InitiatePaymentResponse,
  VerifyPaymentPayload,
  PaginatedResponse,
} from '@strikers/shared';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  withCredentials: true, // send httpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Response interceptor — unwrap data envelope ──────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ?? error.message ?? 'Unknown error';
    return Promise.reject(new Error(message));
  },
);

// ── Auth ─────────────────────────────────────────────────────
export const authApi = {
  async register(data: {
    name: string;
    email: string;
    phone: string;
    age: number;
    password: string;
  }): Promise<AuthResponse> {
    const res = await api.post<{ data: AuthResponse }>('/api/auth/register', data);
    return res.data.data;
  },

  async login(phone: string, password: string): Promise<AuthResponse> {
    const res = await api.post<{ data: AuthResponse }>('/api/auth/login', { phone, password });
    return res.data.data;
  },

  async logout(): Promise<void> {
    await api.post('/api/auth/logout');
  },

  async me(): Promise<User> {
    const res = await api.get<{ data: { user: User } }>('/api/auth/me');
    return res.data.data.user;
  },
};

// ── Facilities ────────────────────────────────────────────────
export const facilityApi = {
  async list(): Promise<Facility[]> {
    const res = await api.get<{ data: { facilities: Facility[] } }>('/api/facilities');
    return res.data.data.facilities;
  },

  async getById(id: string): Promise<Facility> {
    const res = await api.get<{ data: { facility: Facility } }>(`/api/facilities/${id}`);
    return res.data.data.facility;
  },

  async getSlots(
    facilityId: string,
    date: string,
    availableOnly = true,
  ): Promise<Slot[]> {
    const res = await api.get<{ data: { slots: Slot[] } }>(
      `/api/facilities/${facilityId}/slots`,
      { params: { date, availableOnly } },
    );
    return res.data.data.slots;
  },

  async create(data: {
    name: string;
    type: 'NET' | 'TURF';
    description?: string;
    pricePerSlot: number;
  }): Promise<Facility> {
    const res = await api.post<{ data: { facility: Facility } }>('/api/facilities', data);
    return res.data.data.facility;
  },

  async update(id: string, data: {
    name?: string;
    type?: 'NET' | 'TURF';
    description?: string;
    pricePerSlot?: number;
    isActive?: boolean;
  }): Promise<Facility> {
    const res = await api.patch<{ data: { facility: Facility } }>(`/api/facilities/${id}`, data);
    return res.data.data.facility;
  },
};

export interface UpdateSlotResponse extends Booking {
  newPrice: number;
  oldPrice: number;
  priceDiff: number;
  extraPayment?: {
    razorpayOrderId: string;
    amount: number;
    currency: string;
    keyId: string;
  };
  refundedAmount?: number;
}

// ── Bookings ──────────────────────────────────────────────────
export const bookingApi = {
  async create(slotId: string, paymentMethod: 'ONLINE' | 'OFFLINE' = 'ONLINE'): Promise<Booking> {
    const res = await api.post<{ data: { booking: Booking } }>('/api/bookings', { slotId, paymentMethod });
    return res.data.data.booking;
  },

  async listMine(): Promise<Booking[]> {
    const res = await api.get<{ data: Booking[] }>('/api/bookings');
    return res.data.data;
  },

  async getById(id: string): Promise<Booking> {
    const res = await api.get<{ data: { booking: Booking } }>(`/api/bookings/${id}`);
    return res.data.data.booking;
  },

  async cancel(id: string): Promise<Booking> {
    const res = await api.patch<{ data: { booking: Booking } }>(`/api/bookings/${id}/cancel`);
    return res.data.data.booking;
  },

  async updateSlot(id: string, slotId: string, extraPaymentMethod?: 'ONLINE' | 'OFFLINE'): Promise<UpdateSlotResponse> {
    const res = await api.patch<{ data: { booking: UpdateSlotResponse } }>(`/api/bookings/${id}/update-slot`, {
      slotId,
      ...(extraPaymentMethod ? { extraPaymentMethod } : {}),
    });
    return res.data.data.booking;
  },
};

// ── Payments ──────────────────────────────────────────────────
export const paymentApi = {
  async initiate(bookingId: string): Promise<InitiatePaymentResponse> {
    const res = await api.post<{ data: InitiatePaymentResponse }>(
      '/api/payments/initiate',
      { bookingId },
    );
    return res.data.data;
  },

  async verify(payload: VerifyPaymentPayload): Promise<void> {
    await api.post('/api/payments/verify', payload);
  },

  async verifyExtra(payload: VerifyPaymentPayload): Promise<void> {
    await api.post('/api/payments/verify-extra', payload);
  },
};

// ── Admin ────────────────────────────────────────────────────
export interface DashboardStats {
  totalBookings: number;
  confirmedBookings: number;
  todayBookings: number;
  activeFacilities: number;
  totalUsers: number;
  totalRevenue: number;
  totalRefunds: number;
  netRevenue: number;
}

export interface AdminBooking extends Booking {
  user?: { id: string; name: string; phone: string; email: string };
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  age: number;
  role: string;
  createdAt: string;
  _count: { bookings: number };
}

export interface RevenueReport {
  from: string;
  to: string;
  totalRevenue: number;
  netRevenue: number;
  totalOnline: number;
  totalOffline: number;
  totalRefunds: number;
  totalRefundCount: number;
  totalPayments: number;
  daily: { date: string; revenue: number; count: number; online: number; offline: number; refunds: number; refundCount: number }[];
}

export interface RazorpayVerification {
  local: {
    id: string;
    status: string;
    amount: number;
    method: string;
    razorpayPaymentId: string | null;
    razorpayOrderId: string | null;
    paidAt: string | null;
    refundedAt: string | null;
    booking: AdminBooking;
  };
  razorpay: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    method: string;
    captured: boolean;
    refundStatus: string | null;
    amountRefunded: number;
    createdAt: string | null;
  };
}

export interface FacilityTypeItem {
  id: string;
  name: string;
  label: string;
  description: string;
  isActive: boolean;
}

export const adminApi = {
  async dashboard(): Promise<DashboardStats> {
    const res = await api.get<{ data: { stats: DashboardStats } }>('/api/admin/dashboard');
    return res.data.data.stats;
  },

  async listBookings(params?: {
    status?: string;
    date?: string;
    facilityId?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<AdminBooking>> {
    const res = await api.get<PaginatedResponse<AdminBooking>>('/api/admin/bookings', { params });
    return res.data;
  },

  async createManualBooking(data: {
    userId: string;
    slotId: string;
    bookingFor?: string;
    playerName?: string;
    teamName?: string;
    paymentMethod?: string;
    notes?: string;
  }): Promise<AdminBooking> {
    const res = await api.post<{ data: { booking: AdminBooking } }>('/api/admin/bookings', data);
    return res.data.data.booking;
  },

  async updateBookingStatus(id: string, data: { status: string; notes?: string }): Promise<AdminBooking> {
    const res = await api.patch<{ data: { booking: AdminBooking } }>(`/api/admin/bookings/${id}/status`, data);
    return res.data.data.booking;
  },

  async listUsers(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<AdminUser>> {
    const res = await api.get<PaginatedResponse<AdminUser>>('/api/admin/users', { params });
    return res.data;
  },

  async createUser(data: {
    name: string; email: string; phone: string; age: number; password: string; role?: string;
  }): Promise<AdminUser> {
    const res = await api.post<{ data: { user: AdminUser } }>('/api/admin/users', data);
    return res.data.data.user;
  },

  async updateUser(id: string, data: {
    name?: string; email?: string; age?: number; role?: string; password?: string;
  }): Promise<AdminUser> {
    const res = await api.patch<{ data: { user: AdminUser } }>(`/api/admin/users/${id}`, data);
    return res.data.data.user;
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/api/admin/users/${id}`);
  },

  async bulkCreateSlots(data: {
    facilityId: string;
    startDate: string;
    endDate: string;
    timeSlots: { startTime: string; endTime: string }[];
    capacity?: number;
  }): Promise<{ created: number; skipped: number }> {
    const res = await api.post<{ data: { created: number; skipped: number } }>('/api/admin/slots/bulk', data);
    return res.data.data;
  },

  async blockSlots(data: {
    facilityId?: string;
    date: string;
    startTime?: string;
    endTime?: string;
    reason: string;
  }): Promise<void> {
    await api.post('/api/admin/slots/block', data);
  },

  async removeBlock(id: string): Promise<void> {
    await api.delete(`/api/admin/slots/block/${id}`);
  },

  async revenueReport(params: { from: string; to: string }): Promise<RevenueReport> {
    const res = await api.get<{ data: { report: RevenueReport } }>('/api/admin/reports/revenue', { params });
    return res.data.data.report;
  },

  async listCoupons(): Promise<Coupon[]> {
    const res = await api.get<{ data: { coupons: Coupon[] } }>('/api/admin/coupons');
    return res.data.data.coupons;
  },

  async createCoupon(data: {
    code: string;
    description?: string;
    discountType: 'FIXED' | 'PERCENT';
    discountValue: number;
    maxUsage?: number;
    validFrom: string;
    validUntil?: string;
  }): Promise<Coupon> {
    const res = await api.post<{ data: { coupon: Coupon } }>('/api/admin/coupons', data);
    return res.data.data.coupon;
  },

  async updateCoupon(id: string, data: {
    description?: string;
    discountValue?: number;
    maxUsage?: number;
    validUntil?: string | null;
    isActive?: boolean;
  }): Promise<Coupon> {
    const res = await api.patch<{ data: { coupon: Coupon } }>(`/api/admin/coupons/${id}`, data);
    return res.data.data.coupon;
  },

  async listFacilities(): Promise<Facility[]> {
    const res = await api.get<{ data: { facilities: Facility[] } }>('/api/facilities');
    return res.data.data.facilities;
  },

  async verifyPayment(paymentId: string): Promise<RazorpayVerification> {
    const res = await api.get<{ data: RazorpayVerification }>(`/api/admin/payments/${paymentId}/verify`);
    return res.data.data;
  },

  async listFacilityTypes(): Promise<FacilityTypeItem[]> {
    const res = await api.get<{ data: { types: FacilityTypeItem[] } }>('/api/admin/facility-types');
    return res.data.data.types;
  },

  async createFacilityType(data: { name: string; label: string; description?: string }): Promise<FacilityTypeItem> {
    const res = await api.post<{ data: { type: FacilityTypeItem } }>('/api/admin/facility-types', data);
    return res.data.data.type;
  },

  async updateFacilityType(id: string, data: { label?: string; description?: string; isActive?: boolean }): Promise<FacilityTypeItem> {
    const res = await api.patch<{ data: { type: FacilityTypeItem } }>(`/api/admin/facility-types/${id}`, data);
    return res.data.data.type;
  },

  async deleteFacilityType(id: string): Promise<void> {
    await api.delete(`/api/admin/facility-types/${id}`);
  },
};

export default api;
