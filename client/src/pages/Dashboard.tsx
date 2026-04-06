import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../hooks/useAuth';
import { useBookings } from '../hooks/useBookings';
import { bookingApi, facilityApi, paymentApi } from '../services/api';
import type { Facility, Slot, Booking } from '@strikers/shared';

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-600',
  WAITLISTED: 'bg-blue-100 text-blue-700',
};

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

/** Modal for picking a new slot to reschedule a booking */
function UpdateSlotModal({ booking, onClose, onUpdated }: {
  booking: Booking;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState(booking.slot?.facility?.id ?? '');
  const [selectedDate, setSelectedDate] = useState(booking.slot?.date ?? '');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [extraPaymentMethod, setExtraPaymentMethod] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    facilityApi.list().then(setFacilities).catch(() => setErr('Failed to load facilities'));
  }, []);

  useEffect(() => {
    if (!selectedFacility || !selectedDate) { setSlots([]); return; }
    setSlotsLoading(true);
    facilityApi.getSlots(selectedFacility, selectedDate, false)
      .then(setSlots)
      .catch(() => setErr('Failed to load slots'))
      .finally(() => setSlotsLoading(false));
  }, [selectedFacility, selectedDate]);

  const selectedSlotData = slots.find(s => s.id === selectedSlot);
  const currentPrice = booking.payment?.amount ?? 0;
  const newPrice = selectedSlotData?.effectivePrice ?? 0;
  const priceDiff = selectedSlot ? newPrice - currentPrice : 0;
  const priceGoesUp = priceDiff > 0;
  const priceGoesDown = priceDiff < 0;
  const wasPaidOnline = booking.payment?.status === 'SUCCESS' && booking.paymentMethod === 'ONLINE';

  const handleUpdate = async () => {
    if (!selectedSlot) return;
    setUpdating(true);
    setErr(null);
    setSuccessMsg(null);
    try {
      const result = await bookingApi.updateSlot(
        booking.id,
        selectedSlot,
        priceGoesUp ? extraPaymentMethod : undefined,
      );

      // If extra online payment needed, open Razorpay checkout
      if (result.extraPayment) {
        openRazorpayForExtra(result.extraPayment, booking.id);
        return; // Don't close modal yet — wait for Razorpay
      }

      // If partial refund was issued
      if (result.refundedAmount) {
        setSuccessMsg(`Rescheduled! Refund of ${formatPaise(result.refundedAmount)} initiated.`);
        setTimeout(() => onUpdated(), 2000);
        return;
      }

      onUpdated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed');
      setUpdating(false);
    }
  };

  const openRazorpayForExtra = (
    extra: { razorpayOrderId: string; amount: number; currency: string; keyId: string },
    bookingId: string,
  ) => {
    if (!window.Razorpay) {
      setErr('Razorpay not loaded. Please refresh and try again.');
      setUpdating(false);
      return;
    }

    const rzp = new window.Razorpay({
      key: extra.keyId,
      amount: extra.amount,
      currency: extra.currency,
      name: 'StrikersAcademy',
      description: `Extra payment for reschedule`,
      order_id: extra.razorpayOrderId,
      handler: async (response) => {
        try {
          await paymentApi.verifyExtra({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            bookingId,
          });
          setSuccessMsg('Rescheduled and extra payment completed!');
          setTimeout(() => onUpdated(), 2000);
        } catch {
          setErr('Extra payment verification failed. Contact support.');
          setUpdating(false);
        }
      },
      theme: { color: '#f97316' },
      modal: {
        ondismiss: () => {
          setErr('Payment cancelled. Booking was rescheduled but extra amount is pending.');
          setUpdating(false);
        },
      },
    });

    rzp.open();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Reschedule Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <p className="text-sm text-gray-500">
          Current: {booking.slot?.facility?.name} &middot; {booking.slot?.date} &middot; {booking.slot?.startTime}–{booking.slot?.endTime}
        </p>

        {err && <div className="rounded bg-red-50 border border-red-200 p-2 text-sm text-red-700">{err}</div>}
        {successMsg && <div className="rounded bg-green-50 border border-green-200 p-2 text-sm text-green-700">{successMsg}</div>}

        {!successMsg && (
          <>
            {/* Facility */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facility</label>
              <select
                value={selectedFacility}
                onChange={(e) => { setSelectedFacility(e.target.value); setSelectedSlot(''); }}
                className="input w-full"
              >
                <option value="">Select facility</option>
                {facilities.map(f => <option key={f.id} value={f.id}>{f.name} ({f.type}) — ₹{(f.pricePerSlot / 100).toFixed(0)}/slot</option>)}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                min={today}
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlot(''); }}
                className="input w-full"
              />
            </div>

            {/* Slots */}
            {selectedFacility && selectedDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Slot</label>
                {slotsLoading ? <p className="text-sm text-gray-500">Loading...</p> : slots.length === 0 ? (
                  <p className="text-sm text-gray-500">No slots for this date.</p>
                ) : (
                  <div className="grid gap-2 grid-cols-3">
                    {slots.map(slot => {
                      const isCurrent = slot.id === booking.slotId;
                      return (
                        <button
                          key={slot.id}
                          disabled={!slot.isAvailable && !isCurrent}
                          onClick={() => setSelectedSlot(slot.id)}
                          className={`rounded border p-2 text-xs transition-colors ${
                            isCurrent
                              ? 'border-gray-300 bg-gray-100 text-gray-500'
                              : !slot.isAvailable
                              ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                              : selectedSlot === slot.id
                              ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                              : 'border-gray-200 hover:border-brand-300'
                          }`}
                        >
                          {slot.startTime}–{slot.endTime}
                          {isCurrent && ' (current)'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Price breakdown */}
            {selectedSlot && selectedSlot !== booking.slotId && (
              <div className={`rounded border p-3 text-sm ${
                priceDiff === 0
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-800'
              }`}>
                <div className="flex justify-between">
                  <span>Current price:</span>
                  <span className="font-medium">{formatPaise(currentPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>New price:</span>
                  <span className="font-medium">{formatPaise(newPrice)}</span>
                </div>
                {priceDiff !== 0 && (
                  <div className="flex justify-between mt-1 pt-1 border-t border-yellow-200 font-medium">
                    <span>{priceGoesUp ? 'Extra to pay:' : 'Refund amount:'}</span>
                    <span>{formatPaise(Math.abs(priceDiff))}</span>
                  </div>
                )}
                {priceGoesDown && wasPaidOnline && (
                  <p className="text-xs mt-2">Partial refund of {formatPaise(Math.abs(priceDiff))} will be sent to your account via Razorpay.</p>
                )}
                {priceGoesDown && !wasPaidOnline && (
                  <p className="text-xs mt-2">Collect remaining amount of {formatPaise(Math.abs(priceDiff))} from the venue.</p>
                )}
              </div>
            )}

            {/* Extra payment method choice (only when price goes up) */}
            {selectedSlot && selectedSlot !== booking.slotId && priceGoesUp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How to pay the extra {formatPaise(priceDiff)}?
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setExtraPaymentMethod('ONLINE')}
                    className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                      extraPaymentMethod === 'ONLINE'
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900 text-sm">Pay Online</div>
                    <div className="text-xs text-gray-500">UPI / Razorpay</div>
                  </button>
                  <button
                    onClick={() => setExtraPaymentMethod('OFFLINE')}
                    className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                      extraPaymentMethod === 'OFFLINE'
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900 text-sm">Pay at Venue</div>
                    <div className="text-xs text-gray-500">Cash / UPI at counter</div>
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleUpdate}
                disabled={!selectedSlot || selectedSlot === booking.slotId || updating}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {updating
                  ? 'Processing...'
                  : priceGoesUp && extraPaymentMethod === 'ONLINE'
                  ? `Reschedule & Pay ${formatPaise(priceDiff)}`
                  : 'Confirm Reschedule'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type StatusFilter = 'ALL' | 'CONFIRMED' | 'PENDING' | 'CANCELLED';

export default function DashboardPage() {
  const { user } = useAuth();
  const { bookings, isLoading, error, refetch } = useBookings();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [updatingBooking, setUpdatingBooking] = useState<Booking | null>(null);

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Cancel this booking? If paid online, a refund will be issued.')) return;
    setCancelling(bookingId);
    setCancelError(null);
    try {
      await bookingApi.cancel(bookingId);
      refetch();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setCancelling(null);
    }
  };

  const canCancel = (status: string) => status === 'PENDING' || status === 'CONFIRMED';

  const filteredBookings = filter === 'ALL'
    ? bookings
    : bookings.filter((b) => b.status === filter);

  const stats = [
    { label: 'Total Bookings', value: bookings.length, filter: 'ALL' as StatusFilter, color: 'text-gray-900' },
    { label: 'Confirmed', value: bookings.filter((b) => b.status === 'CONFIRMED').length, filter: 'CONFIRMED' as StatusFilter, color: 'text-green-600' },
    { label: 'Pending', value: bookings.filter((b) => b.status === 'PENDING').length, filter: 'PENDING' as StatusFilter, color: 'text-yellow-600' },
    { label: 'Cancelled', value: bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'REFUNDED').length, filter: 'CANCELLED' as StatusFilter, color: 'text-red-600' },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage your cricket sessions
            </p>
          </div>
          <Link to="/booking" className="btn-primary">
            Book a Slot
          </Link>
        </div>

        {/* Clickable Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <button
              key={s.label}
              onClick={() => setFilter(s.filter)}
              className={`card text-left transition-all ${
                filter === s.filter
                  ? 'ring-2 ring-brand-500 shadow-md'
                  : 'hover:shadow-md'
              }`}
            >
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>
                {isLoading ? '—' : s.value}
              </p>
            </button>
          ))}
        </div>

        {/* Bookings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {filter === 'ALL' ? 'All Bookings' : `${filter.charAt(0) + filter.slice(1).toLowerCase()} Bookings`}
            </h2>
            {filter !== 'ALL' && (
              <button onClick={() => setFilter('ALL')} className="text-xs text-brand-600 hover:underline">
                Show all
              </button>
            )}
          </div>

          {cancelError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 mb-4">
              {cancelError}
            </div>
          )}

          {isLoading && <p className="text-gray-500">Loading...</p>}
          {error && <p className="text-red-600">{error}</p>}
          {!isLoading && filteredBookings.length === 0 && (
            <div className="card text-center text-gray-500">
              {bookings.length === 0 ? (
                <>
                  <p>No bookings yet.</p>
                  <Link to="/booking" className="btn-primary mt-4 inline-block">
                    Book your first slot
                  </Link>
                </>
              ) : (
                <p>No {filter.toLowerCase()} bookings.</p>
              )}
            </div>
          )}
          {!isLoading && filteredBookings.length > 0 && (
            <div className="space-y-3">
              {filteredBookings.map((booking) => (
                <div key={booking.id} className="card">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">
                        {booking.slot?.facility?.name ?? 'Facility'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {booking.slot?.date} &middot; {booking.slot?.startTime}–{booking.slot?.endTime}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {booking.paymentMethod === 'ONLINE' ? 'Online payment' : 'Pay at venue'}
                        {booking.payment ? ` · ${formatPaise(booking.payment.amount)}` : ''}
                        {booking.payment?.status === 'SUCCESS' && ' · Paid'}
                        {booking.payment?.status === 'REFUNDED' && ' · Refunded'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[booking.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {booking.status}
                      </span>
                      {canCancel(booking.status) && (
                        <>
                          <button
                            onClick={() => setUpdatingBooking(booking)}
                            className="rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700"
                          >
                            Update
                          </button>
                          <button
                            onClick={() => handleCancel(booking.id)}
                            disabled={cancelling === booking.id}
                            className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {cancelling === booking.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        </>
                      )}
                      {booking.status === 'PENDING' && booking.paymentMethod === 'ONLINE' && (
                        <Link
                          to={`/payment/${booking.id}`}
                          className="rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700"
                        >
                          Pay
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reschedule Modal */}
      {updatingBooking && (
        <UpdateSlotModal
          booking={updatingBooking}
          onClose={() => setUpdatingBooking(null)}
          onUpdated={() => { setUpdatingBooking(null); refetch(); }}
        />
      )}
    </Layout>
  );
}
