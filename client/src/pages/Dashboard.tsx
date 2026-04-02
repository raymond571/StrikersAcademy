import { Link } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../hooks/useAuth';
import { useBookings } from '../hooks/useBookings';

export default function DashboardPage() {
  const { user } = useAuth();
  const { bookings, isLoading, error } = useBookings();

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

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card">
            <p className="text-sm text-gray-500">Total Bookings</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {isLoading ? '—' : bookings.length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Confirmed</p>
            <p className="text-3xl font-bold text-pitch-600 mt-1">
              {isLoading ? '—' : bookings.filter((b) => b.status === 'CONFIRMED').length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-3xl font-bold text-brand-500 mt-1">
              {isLoading ? '—' : bookings.filter((b) => b.status === 'PENDING').length}
            </p>
          </div>
        </div>

        {/* Recent Bookings */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Your Bookings
          </h2>
          {isLoading && <p className="text-gray-500">Loading...</p>}
          {error && <p className="text-red-600">{error}</p>}
          {!isLoading && bookings.length === 0 && (
            <div className="card text-center text-gray-500">
              <p>No bookings yet.</p>
              <Link to="/booking" className="btn-primary mt-4 inline-block">
                Book your first slot
              </Link>
            </div>
          )}
          {!isLoading && bookings.length > 0 && (
            <div className="space-y-3">
              {bookings.map((booking) => (
                <div key={booking.id} className="card flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {booking.slot?.facility?.name ?? 'Facility'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {booking.slot?.date} · {booking.slot?.startTime}–{booking.slot?.endTime}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      booking.status === 'CONFIRMED'
                        ? 'bg-pitch-100 text-pitch-700'
                        : booking.status === 'PENDING'
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
