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
  InitiatePaymentResponse,
  VerifyPaymentPayload,
} from '@strikers/shared';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
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
    password: string;
  }): Promise<AuthResponse> {
    const res = await api.post<{ data: AuthResponse }>('/api/auth/register', data);
    return res.data.data;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await api.post<{ data: AuthResponse }>('/api/auth/login', { email, password });
    return res.data.data;
  },

  async logout(): Promise<void> {
    await api.post('/api/auth/logout');
  },

  async me(): Promise<User> {
    const res = await api.get<{ data: User }>('/api/auth/me');
    return res.data.data;
  },
};

// ── Facilities ────────────────────────────────────────────────
export const facilityApi = {
  async list(): Promise<Facility[]> {
    const res = await api.get<{ data: Facility[] }>('/api/facilities');
    return res.data.data;
  },

  async getById(id: string): Promise<Facility> {
    const res = await api.get<{ data: Facility }>(`/api/facilities/${id}`);
    return res.data.data;
  },

  async getSlots(
    facilityId: string,
    date: string,
    availableOnly = true,
  ): Promise<Slot[]> {
    const res = await api.get<{ data: Slot[] }>(
      `/api/facilities/${facilityId}/slots`,
      { params: { date, availableOnly } },
    );
    return res.data.data;
  },
};

// ── Bookings ──────────────────────────────────────────────────
export const bookingApi = {
  async create(slotId: string): Promise<Booking> {
    const res = await api.post<{ data: Booking }>('/api/bookings', { slotId });
    return res.data.data;
  },

  async listMine(): Promise<Booking[]> {
    const res = await api.get<{ data: Booking[] }>('/api/bookings');
    return res.data.data;
  },

  async getById(id: string): Promise<Booking> {
    const res = await api.get<{ data: Booking }>(`/api/bookings/${id}`);
    return res.data.data;
  },

  async cancel(id: string): Promise<Booking> {
    const res = await api.patch<{ data: Booking }>(`/api/bookings/${id}/cancel`);
    return res.data.data;
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
};

export default api;
