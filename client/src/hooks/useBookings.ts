import { useState, useEffect } from 'react';
import type { Booking } from '@strikers/shared';
import { bookingApi } from '../services/api';

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = async () => {
    try {
      setIsLoading(true);
      const data = await bookingApi.listMine();
      setBookings(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  return { bookings, isLoading, error, refetch: fetchBookings };
}
