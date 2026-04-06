import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { facilityApi, bookingApi } from '../services/api';
import type { Facility, Slot } from '@strikers/shared';

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

interface CartItem {
  slotId: string;
  facilityId: string;
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
}

export default function BookingPage() {
  const navigate = useNavigate();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [facilitySlots, setFacilitySlots] = useState<Record<string, Slot[]>>({});
  const [loadingSlots, setLoadingSlots] = useState<Record<string, boolean>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [expandedFacilities, setExpandedFacilities] = useState<Record<string, boolean>>({});

  const today = new Date().toISOString().split('T')[0];

  // Load facilities on mount
  useEffect(() => {
    facilityApi.list().then(setFacilities).catch(() => setError('Failed to load facilities'));
  }, []);

  // Load slots for ALL facilities when date changes
  useEffect(() => {
    if (!selectedDate || !facilities.length) return;

    setFacilitySlots({});
    setCart([]);

    for (const f of facilities) {
      setLoadingSlots((prev) => ({ ...prev, [f.id]: true }));
      facilityApi
        .getSlots(f.id, selectedDate, false)
        .then((slots) => {
          setFacilitySlots((prev) => ({ ...prev, [f.id]: slots }));
        })
        .catch(() => {})
        .finally(() => {
          setLoadingSlots((prev) => ({ ...prev, [f.id]: false }));
        });
    }
  }, [selectedDate, facilities]);

  const toggleSlot = (facility: Facility, slot: Slot) => {
    const exists = cart.find((c) => c.slotId === slot.id);
    if (exists) {
      setCart(cart.filter((c) => c.slotId !== slot.id));
    } else {
      setCart([
        ...cart,
        {
          slotId: slot.id,
          facilityId: facility.id,
          facilityName: facility.name,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          price: slot.effectivePrice ?? facility.pricePerSlot,
        },
      ]);
    }
  };

  const isInCart = (slotId: string) => cart.some((c) => c.slotId === slotId);
  const totalPrice = cart.reduce((sum, c) => sum + c.price, 0);

  // Group cart items by facility for summary
  const cartByFacility = cart.reduce<Record<string, CartItem[]>>((acc, item) => {
    if (!acc[item.facilityName]) acc[item.facilityName] = [];
    acc[item.facilityName].push(item);
    return acc;
  }, {});

  const handleBook = async () => {
    if (!cart.length) return;
    setIsBooking(true);
    setError(null);
    try {
      const slotIds = cart.map((c) => c.slotId);
      const result = await bookingApi.createBatch(slotIds, paymentMethod);

      if (paymentMethod === 'ONLINE') {
        // Navigate to payment with batchId
        navigate(`/payment/${result.bookings[0].id}?batchId=${result.batchId}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Book Slots</h1>
          {cart.length > 0 && (
            <button
              onClick={() => setShowSummary(true)}
              className="btn-primary relative"
            >
              View Cart ({cart.length})
              <span className="ml-2 text-xs opacity-80">{formatPaise(totalPrice)}</span>
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: Pick Date */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-3">1. Pick a Date</h2>
          <input
            type="date"
            className="input max-w-xs"
            min={today}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        {/* Step 2: Facilities & Slots */}
        {selectedDate && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">
              2. Select Slots <span className="text-sm font-normal text-gray-500">(tap to add, tap again to remove)</span>
            </h2>

            {facilities.map((f) => {
              const slots = facilitySlots[f.id] || [];
              const loading = loadingSlots[f.id];
              const facilityCartCount = cart.filter((c) => c.facilityId === f.id).length;
              const isExpanded = expandedFacilities[f.id] || false;

              return (
                <div key={f.id} className="card p-0 overflow-hidden">
                  <button
                    onClick={() => setExpandedFacilities((prev) => ({ ...prev, [f.id]: !prev[f.id] }))}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{f.name}</h3>
                      <p className="text-xs text-gray-500">{f.type} &middot; {formatPaise(f.pricePerSlot)}/slot</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {facilityCartCount > 0 && (
                        <span className="rounded-full bg-brand-100 text-brand-700 px-2 py-0.5 text-xs font-medium">
                          {facilityCartCount} selected
                        </span>
                      )}
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      {loading ? (
                        <p className="text-sm text-gray-500 pt-3">Loading...</p>
                      ) : slots.length === 0 ? (
                        <p className="text-sm text-gray-400 pt-3">No slots for this date</p>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 pt-3">
                          {slots.map((slot) => {
                            const inCart = isInCart(slot.id);
                            return (
                              <button
                                key={slot.id}
                                disabled={!slot.isAvailable && !inCart}
                                onClick={() => toggleSlot(f, slot)}
                                className={`rounded border px-1.5 py-1.5 text-xs transition-colors ${
                                  inCart
                                    ? 'border-brand-500 bg-brand-500 text-white font-medium'
                                    : !slot.isAvailable
                                    ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                                    : 'border-gray-200 hover:border-brand-300 text-gray-700'
                                }`}
                              >
                                {slot.startTime}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Floating cart bar */}
        {cart.length > 0 && !showSummary && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg px-4 py-3 sm:hidden">
            <button
              onClick={() => setShowSummary(true)}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <span>View Cart ({cart.length} slots)</span>
              <span className="text-sm opacity-80">{formatPaise(totalPrice)}</span>
            </button>
          </div>
        )}

        {/* Summary Modal */}
        {showSummary && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Booking Summary</h2>
                <button onClick={() => setShowSummary(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>

              <p className="text-sm text-gray-500">{selectedDate} &middot; {cart.length} slot{cart.length > 1 ? 's' : ''}</p>

              {/* Cart items grouped by facility */}
              <div className="space-y-3">
                {Object.entries(cartByFacility).map(([facilityName, items]) => (
                  <div key={facilityName} className="rounded-lg border border-gray-200 p-3">
                    <p className="font-medium text-gray-900 text-sm">{facilityName}</p>
                    <div className="mt-2 space-y-1">
                      {items.sort((a, b) => a.startTime.localeCompare(b.startTime)).map((item) => (
                        <div key={item.slotId} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{item.startTime} – {item.endTime}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900">{formatPaise(item.price)}</span>
                            <button
                              onClick={() => setCart(cart.filter((c) => c.slotId !== item.slotId))}
                              className="text-red-400 hover:text-red-600 text-xs"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between border-t pt-3">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold text-brand-600">{formatPaise(totalPrice)}</span>
              </div>

              {/* Payment Method */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Payment Method</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPaymentMethod('ONLINE')}
                    className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                      paymentMethod === 'ONLINE'
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900 text-sm">Pay Online</div>
                    <div className="text-xs text-gray-500">UPI / Razorpay</div>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('OFFLINE')}
                    className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                      paymentMethod === 'OFFLINE'
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900 text-sm">Pay at Venue</div>
                    <div className="text-xs text-gray-500">Cash / UPI at counter</div>
                  </button>
                </div>
              </div>

              {/* Confirm */}
              <button
                onClick={handleBook}
                disabled={isBooking || cart.length === 0}
                className="btn-primary w-full text-base py-3 disabled:opacity-50"
              >
                {isBooking
                  ? 'Creating bookings...'
                  : paymentMethod === 'ONLINE'
                  ? `Confirm & Pay ${formatPaise(totalPrice)}`
                  : `Confirm ${cart.length} Slot${cart.length > 1 ? 's' : ''} (Pay at Venue)`}
              </button>

              <button
                onClick={() => setShowSummary(false)}
                className="btn-secondary w-full"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
