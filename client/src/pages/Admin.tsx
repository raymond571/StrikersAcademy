import { Layout } from '../components/layout/Layout';

/**
 * Admin panel — placeholder.
 * Will be expanded with: dashboard stats, booking management,
 * facility CRUD, slot bulk creation, user management.
 */
export default function AdminPage() {
  return (
    <Layout>
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {['Total Bookings', 'Revenue', 'Active Facilities', 'Users'].map((stat) => (
            <div key={stat} className="card">
              <p className="text-sm text-gray-500">{stat}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">—</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Facilities */}
          <div className="card">
            <h2 className="text-base font-semibold mb-4">Facilities</h2>
            <p className="text-sm text-gray-500">TODO: Facility management</p>
          </div>

          {/* Slot Management */}
          <div className="card">
            <h2 className="text-base font-semibold mb-4">Slot Management</h2>
            <p className="text-sm text-gray-500">TODO: Bulk slot creation</p>
          </div>

          {/* Recent Bookings */}
          <div className="card sm:col-span-2">
            <h2 className="text-base font-semibold mb-4">Recent Bookings</h2>
            <p className="text-sm text-gray-500">TODO: Booking list with filters</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
