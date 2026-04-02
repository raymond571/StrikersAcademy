import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../hooks/useAuth';
import { useBookings } from '../hooks/useBookings';
import { bookingApi } from '../services/api';

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

type StatusFilter = 'ALL' | 'CONFIRMED' | 'PENDING' | 'CANCELLED';

export default function DashboardPage() {
  const { user } = useAuth();
  const { bookings, isLoading, error, refetch } = useBookings();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('ALL');

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
                        <button
                          onClick={() => handleCancel(booking.id)}
                          disabled={cancelling === booking.id}
                          className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {cancelling === booking.id ? 'Cancelling...' : 'Cancel'}
                        </button>
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
    </Layout>
  );
}
