import { useState, useCallback } from 'react';
import { Layout } from '../components/layout/Layout';
import { DashboardTab } from '../components/admin/DashboardTab';
import { BookingsTab } from '../components/admin/BookingsTab';
import { UsersTab } from '../components/admin/UsersTab';
import { SlotsTab } from '../components/admin/SlotsTab';
import { FacilitiesTab } from '../components/admin/FacilitiesTab';
import { ReportsTab } from '../components/admin/ReportsTab';
import { CouponsTab } from '../components/admin/CouponsTab';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'facilities', label: 'Facilities' },
  { id: 'users', label: 'Users' },
  { id: 'slots', label: 'Slots' },
  { id: 'reports', label: 'Reports' },
  { id: 'coupons', label: 'Coupons' },
] as const;

export type AdminTabId = (typeof TABS)[number]['id'];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTabId>('dashboard');
  const [bookingFilter, setBookingFilter] = useState<string>('');

  const navigateToTab = useCallback((tab: AdminTabId, filter?: string) => {
    setActiveTab(tab);
    if (tab === 'bookings' && filter !== undefined) {
      setBookingFilter(filter);
    }
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>

        {/* Tab navigation */}
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex gap-0 -mb-px min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setBookingFilter(''); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === 'dashboard' && <DashboardTab onNavigate={navigateToTab} />}
        {activeTab === 'bookings' && <BookingsTab initialFilter={bookingFilter} />}
        {activeTab === 'facilities' && <FacilitiesTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'slots' && <SlotsTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'coupons' && <CouponsTab />}
      </div>
    </Layout>
  );
}
