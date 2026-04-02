import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => {
  const mockAxios: any = {
    create: vi.fn(() => mockAxios),
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      response: { use: vi.fn() },
    },
  };
  return { default: mockAxios };
});

// Must import after mock setup
import { authApi, facilityApi, bookingApi, paymentApi } from './api';

const mockAxios = axios as any;

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('register calls POST /api/auth/register', async () => {
    const userData = { name: 'Arul', email: 'a@t.com', phone: '9876543210', age: 25, password: 'pass' };
    mockAxios.post.mockResolvedValue({ data: { data: { user: { id: 'u1' } } } });

    const result = await authApi.register(userData);
    expect(mockAxios.post).toHaveBeenCalledWith('/api/auth/register', userData);
    expect(result).toEqual({ user: { id: 'u1' } });
  });

  it('login calls POST /api/auth/login', async () => {
    mockAxios.post.mockResolvedValue({ data: { data: { user: { id: 'u1' } } } });

    const result = await authApi.login('9876543210', 'pass');
    expect(mockAxios.post).toHaveBeenCalledWith('/api/auth/login', {
      phone: '9876543210',
      password: 'pass',
    });
  });

  it('logout calls POST /api/auth/logout', async () => {
    mockAxios.post.mockResolvedValue({});

    await authApi.logout();
    expect(mockAxios.post).toHaveBeenCalledWith('/api/auth/logout');
  });

  it('me calls GET /api/auth/me', async () => {
    mockAxios.get.mockResolvedValue({ data: { data: { id: 'u1', name: 'Arul' } } });

    const result = await authApi.me();
    expect(mockAxios.get).toHaveBeenCalledWith('/api/auth/me');
    expect(result).toEqual({ id: 'u1', name: 'Arul' });
  });
});

describe('facilityApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('list calls GET /api/facilities', async () => {
    mockAxios.get.mockResolvedValue({ data: { data: [{ id: 'f1' }] } });

    const result = await facilityApi.list();
    expect(mockAxios.get).toHaveBeenCalledWith('/api/facilities');
    expect(result).toEqual([{ id: 'f1' }]);
  });

  it('getById calls GET /api/facilities/:id', async () => {
    mockAxios.get.mockResolvedValue({ data: { data: { id: 'f1', name: 'Net 1' } } });

    const result = await facilityApi.getById('f1');
    expect(mockAxios.get).toHaveBeenCalledWith('/api/facilities/f1');
  });

  it('getSlots calls GET with date and availableOnly params', async () => {
    mockAxios.get.mockResolvedValue({ data: { data: [{ id: 's1' }] } });

    await facilityApi.getSlots('f1', '2026-04-10', true);
    expect(mockAxios.get).toHaveBeenCalledWith('/api/facilities/f1/slots', {
      params: { date: '2026-04-10', availableOnly: true },
    });
  });
});

describe('bookingApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create calls POST /api/bookings', async () => {
    mockAxios.post.mockResolvedValue({ data: { data: { id: 'bk-1' } } });

    const result = await bookingApi.create('slot-1');
    expect(mockAxios.post).toHaveBeenCalledWith('/api/bookings', { slotId: 'slot-1' });
  });

  it('listMine calls GET /api/bookings', async () => {
    mockAxios.get.mockResolvedValue({ data: { data: [{ id: 'bk-1' }] } });

    const result = await bookingApi.listMine();
    expect(mockAxios.get).toHaveBeenCalledWith('/api/bookings');
  });

  it('cancel calls PATCH /api/bookings/:id/cancel', async () => {
    mockAxios.patch.mockResolvedValue({ data: { data: { id: 'bk-1', status: 'CANCELLED' } } });

    const result = await bookingApi.cancel('bk-1');
    expect(mockAxios.patch).toHaveBeenCalledWith('/api/bookings/bk-1/cancel');
  });
});

describe('paymentApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initiate calls POST /api/payments/initiate', async () => {
    mockAxios.post.mockResolvedValue({ data: { data: { orderId: 'order_1' } } });

    const result = await paymentApi.initiate('bk-1');
    expect(mockAxios.post).toHaveBeenCalledWith('/api/payments/initiate', { bookingId: 'bk-1' });
  });

  it('verify calls POST /api/payments/verify', async () => {
    mockAxios.post.mockResolvedValue({});

    await paymentApi.verify({
      razorpayOrderId: 'o1',
      razorpayPaymentId: 'p1',
      razorpaySignature: 'sig',
    } as any);
    expect(mockAxios.post).toHaveBeenCalledWith('/api/payments/verify', expect.any(Object));
  });
});
