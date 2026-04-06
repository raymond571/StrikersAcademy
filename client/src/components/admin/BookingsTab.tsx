import { useEffect, useState, useCallback } from 'react';
import { adminApi, bookingApi, facilityApi, type AdminBooking } from '../../services/api';
import type { Facility, Slot } from '@strikers/shared';

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  WAITLISTED: 'bg-blue-100 text-blue-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
};

/** Modal for admin to reschedule a booking's slot */
function AdminUpdateSlotModal({ booking, onClose, onUpdated }: {
  booking: AdminBooking;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState(booking.slot?.facility?.id ?? '');
  const [selectedDate, setSelectedDate] = useState(booking.slot?.date ?? '');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [extraPaymentMethod, setExtraPaymentMethod] = useState<'ONLINE' | 'OFFLINE'>('OFFLINE');
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
    try {
      const result = await bookingApi.updateSlot(
        booking.id,
        selectedSlot,
        priceGoesUp ? extraPaymentMethod : undefined,
      );
      if (result.refundedAmount) {
        setSuccessMsg(`Rescheduled! Partial refund of ${formatPaise(result.refundedAmount)} issued via Razorpay.`);
        setTimeout(() => onUpdated(), 2000);
      } else if (priceGoesUp && extraPaymentMethod === 'OFFLINE') {
        setSuccessMsg(`Rescheduled! Collect extra ${formatPaise(priceDiff)} from customer at venue.`);
        setTimeout(() => onUpdated(), 2000);
      } else {
        onUpdated();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Reschedule Booking</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <p className="text-sm text-gray-500">
          Customer: {booking.user?.name} ({booking.user?.phone})<br />
          Current: {booking.slot?.facility?.name} &middot; {booking.slot?.date} &middot; {booking.slot?.startTime}–{booking.slot?.endTime}
        </p>

        {err && <div className="rounded bg-red-50 border border-red-200 p-2 text-sm text-red-700">{err}</div>}
        {successMsg && <div className="rounded bg-green-50 border border-green-200 p-2 text-sm text-green-700">{successMsg}</div>}

        {!successMsg && (
          <>
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
                    <span>{priceGoesUp ? 'Extra to collect:' : 'Refund to issue:'}</span>
                    <span>{formatPaise(Math.abs(priceDiff))}</span>
                  </div>
                )}
                {priceGoesDown && wasPaidOnline && (
                  <p className="text-xs mt-2">Partial refund of {formatPaise(Math.abs(priceDiff))} will be auto-issued via Razorpay.</p>
                )}
              </div>
            )}

            {/* Extra payment method for admin (price increase) */}
            {selectedSlot && selectedSlot !== booking.slotId && priceGoesUp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How will customer pay extra {formatPaise(priceDiff)}?
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setExtraPaymentMethod('OFFLINE')}
                    className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                      extraPaymentMethod === 'OFFLINE'
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900 text-sm">Collect at Venue</div>
                    <div className="text-xs text-gray-500">Cash / UPI at counter</div>
                  </button>
                  <button
                    onClick={() => setExtraPaymentMethod('ONLINE')}
                    className={`flex-1 rounded-lg border p-3 text-left transition-colors ${
                      extraPaymentMethod === 'ONLINE'
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900 text-sm">Online (Razorpay)</div>
                    <div className="text-xs text-gray-500">Customer pays via link</div>
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
                {updating ? 'Processing...' : 'Confirm Reschedule'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface Props {
  initialFilter?: string;
}

export function BookingsTab({ initialFilter = '' }: Props) {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [dateFilter, setDateFilter] = useState('');
  const [updatingBooking, setUpdatingBooking] = useState<AdminBooking | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listBookings({
        page,
        limit: 15,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(dateFilter ? { date: dateFilter } : {}),
      });
      setBookings(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, dateFilter]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const handleStatusChange = async (bookingId: string, newStatus: string, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    try {
      await adminApi.updateBookingStatus(bookingId, { status: newStatus });
      fetchBookings();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input w-auto"
        >
          <option value="">All statuses</option>
          {['PENDING', 'CONFIRMED', 'CANCELLED', 'WAITLISTED', 'REFUNDED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
          className="input w-auto"
        />
        {(statusFilter || dateFilter) && (
          <button
            onClick={() => { setStatusFilter(''); setDateFilter(''); setPage(1); }}
            className="btn-secondary text-xs"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading bookings...</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-gray-500">No bookings found</p>
      ) : (
        <>
          {/* Mobile-friendly card list */}
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {b.user?.name ?? 'Unknown'} <span className="text-xs text-gray-400">{b.user?.phone}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      {b.slot?.facility?.name} &middot; {b.slot?.date} &middot; {b.slot?.startTime}–{b.slot?.endTime}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {b.bookingFor !== 'SELF' && `For: ${b.bookingFor} `}
                      {b.paymentMethod} &middot; {b.payment ? formatPaise(b.payment.amount) : '—'}
                      {b.payment?.status === 'REFUNDED' && ' · Refunded'}
                    </p>
                    {b.notes && <p className="text-xs text-gray-400 italic mt-1">{b.notes}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status] ?? ''}`}>
                      {b.status}
                    </span>
                    {b.status === 'PENDING' && (
                      <button
                        onClick={() => handleStatusChange(b.id, 'CONFIRMED')}
                        className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                      >
                        Confirm
                      </button>
                    )}
                    {(b.status === 'PENDING' || b.status === 'CONFIRMED') && (
                      <>
                        <button
                          onClick={() => setUpdatingBooking(b)}
                          className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                        >
                          Update
                        </button>
                        <button
                          onClick={() => handleStatusChange(b.id, 'CANCELLED', 'Cancel this booking without refund?')}
                          className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {b.status === 'CONFIRMED' && b.payment?.status === 'SUCCESS' && (
                      <button
                        onClick={() => handleStatusChange(b.id, 'REFUNDED', 'Refund this booking? Payment will be returned to customer.')}
                        className="rounded bg-orange-500 px-2 py-1 text-xs text-white hover:bg-orange-600"
                      >
                        Refund
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-secondary text-xs"
              >
                Prev
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary text-xs"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Reschedule Modal */}
      {updatingBooking && (
        <AdminUpdateSlotModal
          booking={updatingBooking}
          onClose={() => setUpdatingBooking(null)}
          onUpdated={() => { setUpdatingBooking(null); fetchBookings(); }}
        />
      )}
    </div>
  );
}
