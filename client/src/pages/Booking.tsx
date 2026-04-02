import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { facilityApi, bookingApi } from '../services/api';
import type { Facility, Slot } from '@strikers/shared';

export default function BookingPage() {
  const navigate = useNavigate();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load facilities on mount
  useEffect(() => {
    facilityApi.list().then(setFacilities).catch(() => setError('Failed to load facilities'));
  }, []);

  // Load slots when facility + date selected
  useEffect(() => {
    if (!selectedFacility || !selectedDate) {
      setSlots([]);
      return;
    }
    setIsLoading(true);
    facilityApi
      .getSlots(selectedFacility, selectedDate)
      .then(setSlots)
      .catch(() => setError('Failed to load slots'))
      .finally(() => setIsLoading(false));
  }, [selectedFacility, selectedDate]);

  const handleBook = async () => {
    if (!selectedSlot) return;
    setIsBooking(true);
    setError(null);
    try {
      const booking = await bookingApi.create(selectedSlot);
      navigate(`/payment/${booking.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setIsBooking(false);
    }
  };

  // Min date = today
  const today = new Date().toISOString().split('T')[0];

  return (
    <Layout>
      <div className="mx-auto max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Book a Slot</h1>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: Select Facility */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            1. Select Facility
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {facilities.map((f) => (
              <button
                key={f.id}
                onClick={() => { setSelectedFacility(f.id); setSelectedSlot(''); }}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selectedFacility === f.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{f.name}</div>
                <div className="text-sm text-gray-500">{f.type}</div>
                <div className="text-sm font-medium text-brand-600 mt-1">
                  ₹{(f.pricePerSlot / 100).toFixed(0)}/slot
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Pick Date */}
        {selectedFacility && (
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              2. Pick a Date
            </h2>
            <input
              type="date"
              className="input max-w-xs"
              min={today}
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(''); }}
            />
          </div>
        )}

        {/* Step 3: Pick Time Slot */}
        {selectedDate && (
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              3. Choose a Time Slot
            </h2>
            {isLoading ? (
              <p className="text-gray-500">Loading slots...</p>
            ) : slots.length === 0 ? (
              <p className="text-gray-500">No slots available for this date.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3">
                {slots.map((slot) => (
                  <button
                    key={slot.id}
                    disabled={!slot.isAvailable}
                    onClick={() => setSelectedSlot(slot.id)}
                    className={`rounded-lg border p-3 text-sm transition-colors ${
                      !slot.isAvailable
                        ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                        : selectedSlot === slot.id
                        ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                        : 'border-gray-200 hover:border-brand-300'
                    }`}
                  >
                    {slot.startTime} – {slot.endTime}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Confirm */}
        {selectedSlot && (
          <button
            onClick={handleBook}
            disabled={isBooking}
            className="btn-primary w-full text-base py-3"
          >
            {isBooking ? 'Creating booking...' : 'Confirm & Proceed to Payment'}
          </button>
        )}
      </div>
    </Layout>
  );
}
