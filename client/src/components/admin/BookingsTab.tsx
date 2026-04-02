import { useEffect, useState, useCallback } from 'react';
import { adminApi, type AdminBooking } from '../../services/api';

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

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
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
                    </p>
                    {b.notes && <p className="text-xs text-gray-400 italic mt-1">{b.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
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
                      <button
                        onClick={() => handleStatusChange(b.id, 'CANCELLED')}
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                      >
                        Cancel
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
    </div>
  );
}
