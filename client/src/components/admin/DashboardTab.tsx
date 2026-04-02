import { useEffect, useState } from 'react';
import { adminApi, type DashboardStats } from '../../services/api';
import type { AdminTabId } from '../../pages/Admin';

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

interface Props {
  onNavigate: (tab: AdminTabId, filter?: string) => void;
}

export function DashboardTab({ onNavigate }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.dashboard().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading dashboard...</p>;
  if (!stats) return <p className="text-sm text-red-500">Failed to load dashboard</p>;

  const cards = [
    { label: 'Total Bookings', value: stats.totalBookings, color: 'text-gray-900', onClick: () => onNavigate('bookings', '') },
    { label: 'Confirmed', value: stats.confirmedBookings, color: 'text-green-600', onClick: () => onNavigate('bookings', 'CONFIRMED') },
    { label: "Today's Bookings", value: stats.todayBookings, color: 'text-blue-600', onClick: () => onNavigate('bookings', '') },
    { label: 'Active Facilities', value: stats.activeFacilities, color: 'text-purple-600', onClick: undefined },
    { label: 'Customers', value: stats.totalUsers, color: 'text-indigo-600', onClick: () => onNavigate('users') },
    { label: 'Total Revenue', value: formatPaise(stats.totalRevenue), color: 'text-emerald-600', onClick: () => onNavigate('reports') },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <button
          key={c.label}
          onClick={c.onClick}
          disabled={!c.onClick}
          className={`card text-left transition-all ${
            c.onClick ? 'hover:shadow-md hover:ring-1 hover:ring-brand-200 cursor-pointer' : 'cursor-default'
          }`}
        >
          <p className="text-sm text-gray-500">{c.label}</p>
          <p className={`text-3xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          {c.onClick && <p className="text-xs text-brand-500 mt-2">Click to view details</p>}
        </button>
      ))}
    </div>
  );
}
