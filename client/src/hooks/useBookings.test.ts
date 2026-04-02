import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBookings } from './useBookings';

vi.mock('../services/api', () => ({
  bookingApi: {
    listMine: vi.fn(),
  },
}));

import { bookingApi } from '../services/api';

describe('useBookings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches bookings on mount', async () => {
    vi.mocked(bookingApi.listMine).mockResolvedValue([
      { id: 'bk-1', status: 'CONFIRMED' },
      { id: 'bk-2', status: 'PENDING' },
    ] as any);

    const { result } = renderHook(() => useBookings());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.bookings).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('sets error when fetch fails', async () => {
    vi.mocked(bookingApi.listMine).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useBookings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.bookings).toHaveLength(0);
  });

  it('sets generic error for non-Error throw', async () => {
    vi.mocked(bookingApi.listMine).mockRejectedValue('string error');

    const { result } = renderHook(() => useBookings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load bookings');
  });

  it('refetch re-fetches bookings', async () => {
    vi.mocked(bookingApi.listMine)
      .mockResolvedValueOnce([{ id: 'bk-1' }] as any)
      .mockResolvedValueOnce([{ id: 'bk-1' }, { id: 'bk-2' }] as any);

    const { result } = renderHook(() => useBookings());

    await waitFor(() => {
      expect(result.current.bookings).toHaveLength(1);
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.bookings).toHaveLength(2);
  });
});
