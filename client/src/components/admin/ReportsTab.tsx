import { useState, useEffect, useCallback } from 'react';
import { adminApi, type DashboardStats, type RevenueReport, type AdminBooking, type RazorpayVerification } from '../../services/api';

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

type ReportSection = 'overview' | 'revenue' | 'bookings' | 'facilities' | 'verify';

export function ReportsTab() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [section, setSection] = useState<ReportSection>('overview');
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(false);

  // Razorpay verification
  const [verifyId, setVerifyId] = useState('');
  const [verifyResult, setVerifyResult] = useState<RazorpayVerification | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.dashboard().then(setStats).catch(console.error);
  }, []);

  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      const [rev, bkRes] = await Promise.all([
        adminApi.revenueReport({ from, to }),
        adminApi.listBookings({ limit: 500, page: 1 }),
      ]);
      setRevenue(rev);
      setBookings(bkRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { generateReport(); }, [generateReport]);

  const handleVerify = async () => {
    if (!verifyId.trim()) return;
    setVerifyLoading(true);
    setVerifyError(null);
    setVerifyResult(null);
    try {
      const result = await adminApi.verifyPayment(verifyId.trim());
      setVerifyResult(result);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Compute breakdowns
  const statusCounts = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const facilityCounts = bookings.reduce<Record<string, { name: string; count: number; online: number; offline: number; onlineRevenue: number; offlineRevenue: number; revenue: number }>>((acc, b) => {
    const fname = b.slot?.facility?.name ?? 'Unknown';
    if (!acc[fname]) acc[fname] = { name: fname, count: 0, online: 0, offline: 0, onlineRevenue: 0, offlineRevenue: 0, revenue: 0 };
    acc[fname].count += 1;
    const amt = b.payment?.status === 'SUCCESS' ? b.payment.amount : 0;
    if (b.paymentMethod === 'ONLINE') {
      acc[fname].online += 1;
      acc[fname].onlineRevenue += amt;
    } else {
      acc[fname].offline += 1;
      acc[fname].offlineRevenue += amt;
    }
    acc[fname].revenue += amt;
    return acc;
  }, {});

  const paymentMethodSplit = bookings.reduce(
    (acc, b) => {
      if (b.paymentMethod === 'ONLINE') acc.online++;
      else acc.offline++;
      return acc;
    },
    { online: 0, offline: 0 },
  );

  const sections: { id: ReportSection; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'bookings', label: 'Booking History' },
    { id: 'facilities', label: 'Facility Usage' },
    { id: 'verify', label: 'Razorpay Verify' },
  ];

  return (
    <div className="space-y-6">
      {/* Date range */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto" />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto" />
        </div>
        <button onClick={generateReport} disabled={loading} className="btn-primary">
          {loading ? 'Loading...' : 'Generate'}
        </button>
      </div>

      {/* Section switcher */}
      <div className="flex gap-2 flex-wrap">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              section === s.id ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Overview ──────────────────────────────── */}
      {section === 'overview' && stats && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/admin/reports/overview/pdf?from=${from}&to=${to}`, { credentials: 'include' });
                  if (!res.ok) { alert('Failed to download'); return; }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `overview-${from}-to-${to}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch { alert('Failed to download PDF'); }
              }}
              className="btn-secondary text-xs"
            >
              Download PDF
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="card">
              <p className="text-sm text-gray-500">All-Time Bookings</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalBookings}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">All-Time Revenue</p>
              <p className="text-3xl font-bold text-emerald-600">{formatPaise(stats.totalRevenue)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Registered Customers</p>
              <p className="text-3xl font-bold text-indigo-600">{stats.totalUsers}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Active Facilities</p>
              <p className="text-3xl font-bold text-purple-600">{stats.activeFacilities}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Today's Bookings</p>
              <p className="text-3xl font-bold text-blue-600">{stats.todayBookings}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Payment Split (period)</p>
              <p className="text-lg font-bold text-gray-900">
                Online: {paymentMethodSplit.online} &middot; Offline: {paymentMethodSplit.offline}
              </p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-base font-semibold mb-3">Booking Status Breakdown (period)</h3>
            <div className="grid gap-3 sm:grid-cols-5">
              {['PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'WAITLISTED'].map((s) => (
                <div key={s} className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{statusCounts[s] || 0}</p>
                  <p className="text-xs text-gray-500">{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Revenue ───────────────────────────────── */}
      {section === 'revenue' && revenue && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/admin/reports/revenue/pdf?from=${from}&to=${to}`, { credentials: 'include' });
                  if (!res.ok) { alert('Failed to download'); return; }
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `revenue-${from}-to-${to}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch { alert('Failed to download PDF'); }
              }}
              className="btn-secondary text-xs"
            >
              Download PDF
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="card">
              <p className="text-sm text-gray-500">Gross Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatPaise(revenue.totalRevenue)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Refunds</p>
              <p className="text-2xl font-bold text-red-600">-{formatPaise(revenue.totalRefunds)}</p>
              <p className="text-xs text-gray-400">{revenue.totalRefundCount} refund(s)</p>
            </div>
            <div className="card border-2 border-emerald-200">
              <p className="text-sm text-gray-500">Net Revenue</p>
              <p className="text-2xl font-bold text-emerald-600">{formatPaise(revenue.netRevenue)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Online</p>
              <p className="text-2xl font-bold text-green-600">{formatPaise(revenue.totalOnline)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Offline</p>
              <p className="text-2xl font-bold text-blue-600">{formatPaise(revenue.totalOffline)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Transactions</p>
              <p className="text-2xl font-bold text-gray-900">{revenue.totalPayments}</p>
            </div>
          </div>

          {revenue.daily.length > 0 ? (
            <div className="card overflow-x-auto">
              <h3 className="text-base font-semibold mb-3">Daily Breakdown</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3 text-right">Revenue</th>
                    <th className="pb-2 pr-3 text-right">Online</th>
                    <th className="pb-2 pr-3 text-right">Offline</th>
                    <th className="pb-2 pr-3 text-right">Refunds</th>
                    <th className="pb-2 pr-3 text-right">Net</th>
                    <th className="pb-2 text-right">Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.daily.map((d) => (
                    <tr key={d.date} className="border-b border-gray-100">
                      <td className="py-2 pr-3 text-gray-900">{d.date}</td>
                      <td className="py-2 pr-3 text-right font-medium">{formatPaise(d.revenue)}</td>
                      <td className="py-2 pr-3 text-right text-green-600">{formatPaise(d.online)}</td>
                      <td className="py-2 pr-3 text-right text-blue-600">{formatPaise(d.offline)}</td>
                      <td className="py-2 pr-3 text-right text-red-600">{d.refunds > 0 ? `-${formatPaise(d.refunds)}` : '—'}</td>
                      <td className="py-2 pr-3 text-right font-medium text-emerald-600">{formatPaise(d.revenue - d.refunds)}</td>
                      <td className="py-2 text-right">{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No revenue data for this period</p>
          )}
        </div>
      )}

      {/* ── Booking History ────────────────────────── */}
      {section === 'bookings' && (
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold">Booking History</h3>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/admin/reports/bookings/csv?from=${from}&to=${to}`, { credentials: 'include' });
                    if (!res.ok) { alert('Failed'); return; }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `bookings-${from}-to-${to}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch { alert('Failed to download'); }
                }}
                className="btn-secondary text-xs"
              >
                Export CSV
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/admin/reports/bookings/pdf?from=${from}&to=${to}`, { credentials: 'include' });
                    if (!res.ok) { alert('Failed'); return; }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `bookings-${from}-to-${to}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch { alert('Failed to download'); }
                }}
                className="btn-secondary text-xs"
              >
                Download PDF
              </button>
            </div>
          </div>
          {bookings.length === 0 ? (
            <p className="text-sm text-gray-500">No bookings found</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-3">Booking ID</th>
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3">Facility</th>
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Payment</th>
                  <th className="pb-2 pr-3">Razorpay ID</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-mono text-xs text-gray-500" title={b.id}>{b.id.slice(-8)}</td>
                    <td className="py-2 pr-3 text-gray-900">{b.user?.name ?? '—'}</td>
                    <td className="py-2 pr-3">{b.slot?.facility?.name ?? '—'}</td>
                    <td className="py-2 pr-3">{b.slot?.date ?? '—'}</td>
                    <td className="py-2 pr-3">{b.slot?.startTime}–{b.slot?.endTime}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        b.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                        b.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        b.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                        b.status === 'REFUNDED' ? 'bg-gray-100 text-gray-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>{b.status}</span>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {b.paymentMethod}
                      {b.payment?.status === 'REFUNDED' && <span className="ml-1 text-red-500">(refunded)</span>}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-gray-500">
                      {b.payment?.razorpayPaymentId ? (
                        <button
                          onClick={() => { setVerifyId(b.payment!.razorpayPaymentId!); setSection('verify'); }}
                          className="text-brand-600 hover:underline"
                          title="Click to verify with Razorpay"
                        >
                          {b.payment.razorpayPaymentId}
                        </button>
                      ) : '—'}
                    </td>
                    <td className="py-2 text-right font-medium">{b.payment ? formatPaise(b.payment.amount) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Facility Usage ─────────────────────────── */}
      {section === 'facilities' && (
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold">Facility Performance (period)</h3>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/admin/reports/facilities/csv?from=${from}&to=${to}`, { credentials: 'include' });
                    if (!res.ok) { alert('Failed'); return; }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `facility-usage-${from}-to-${to}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch { alert('Failed to download'); }
                }}
                className="btn-secondary text-xs"
              >
                Export CSV
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/admin/reports/facilities/pdf?from=${from}&to=${to}`, { credentials: 'include' });
                    if (!res.ok) { alert('Failed'); return; }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `facility-usage-${from}-to-${to}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch { alert('Failed to download'); }
                }}
                className="btn-secondary text-xs"
              >
                Download PDF
              </button>
            </div>
          </div>
          {Object.keys(facilityCounts).length === 0 ? (
            <p className="text-sm text-gray-500">No booking data</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Facility</th>
                  <th className="pb-2 pr-4 text-right">Total Bookings</th>
                  <th className="pb-2 pr-4 text-right">Online</th>
                  <th className="pb-2 pr-4 text-right">Offline</th>
                  <th className="pb-2 pr-4 text-right">Online Revenue</th>
                  <th className="pb-2 pr-4 text-right">Offline Revenue</th>
                  <th className="pb-2 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(facilityCounts)
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((f) => (
                    <tr key={f.name} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-medium text-gray-900">{f.name}</td>
                      <td className="py-2 pr-4 text-right">{f.count}</td>
                      <td className="py-2 pr-4 text-right text-green-600">{f.online}</td>
                      <td className="py-2 pr-4 text-right text-blue-600">{f.offline}</td>
                      <td className="py-2 pr-4 text-right text-green-600">{formatPaise(f.onlineRevenue)}</td>
                      <td className="py-2 pr-4 text-right text-blue-600">{formatPaise(f.offlineRevenue)}</td>
                      <td className="py-2 text-right font-medium text-emerald-600">{formatPaise(f.revenue)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Razorpay Verification ──────────────────── */}
      {section === 'verify' && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h3 className="text-base font-semibold">Cross-verify with Razorpay</h3>
            <p className="text-xs text-gray-500">Enter a Razorpay payment ID (pay_xxx) or local payment ID to fetch live status from Razorpay and compare with local records.</p>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="label">Payment ID</label>
                <input
                  value={verifyId}
                  onChange={(e) => setVerifyId(e.target.value)}
                  className="input"
                  placeholder="pay_SYmwwrlezMCXFT"
                />
              </div>
              <button onClick={handleVerify} disabled={verifyLoading || !verifyId.trim()} className="btn-primary">
                {verifyLoading ? 'Checking...' : 'Verify'}
              </button>
            </div>
          </div>

          {verifyError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{verifyError}</div>
          )}

          {verifyResult && (
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Local record */}
              <div className="card space-y-2">
                <h4 className="font-semibold text-gray-900">Local Record</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-500">Payment ID:</span> {verifyResult.local.id}</p>
                  <p><span className="text-gray-500">Status:</span>{' '}
                    <span className={`font-medium ${verifyResult.local.status === 'SUCCESS' ? 'text-green-600' : verifyResult.local.status === 'REFUNDED' ? 'text-red-600' : 'text-yellow-600'}`}>
                      {verifyResult.local.status}
                    </span>
                  </p>
                  <p><span className="text-gray-500">Amount:</span> {formatPaise(verifyResult.local.amount)}</p>
                  <p><span className="text-gray-500">Method:</span> {verifyResult.local.method}</p>
                  <p><span className="text-gray-500">Razorpay Payment:</span> {verifyResult.local.razorpayPaymentId ?? '—'}</p>
                  <p><span className="text-gray-500">Razorpay Order:</span> {verifyResult.local.razorpayOrderId ?? '—'}</p>
                  <p><span className="text-gray-500">Paid At:</span> {verifyResult.local.paidAt ? new Date(verifyResult.local.paidAt).toLocaleString('en-IN') : '—'}</p>
                  <p><span className="text-gray-500">Refunded At:</span> {verifyResult.local.refundedAt ? new Date(verifyResult.local.refundedAt).toLocaleString('en-IN') : '—'}</p>
                  <hr className="my-2" />
                  <p><span className="text-gray-500">Customer:</span> {verifyResult.local.booking?.user?.name} ({verifyResult.local.booking?.user?.phone})</p>
                  <p><span className="text-gray-500">Booking Status:</span> {verifyResult.local.booking?.status}</p>
                </div>
              </div>

              {/* Razorpay record */}
              <div className="card space-y-2">
                <h4 className="font-semibold text-gray-900">Razorpay Record</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-500">Payment ID:</span> {verifyResult.razorpay.id}</p>
                  <p><span className="text-gray-500">Status:</span>{' '}
                    <span className={`font-medium ${verifyResult.razorpay.status === 'captured' ? 'text-green-600' : verifyResult.razorpay.status === 'refunded' ? 'text-red-600' : 'text-yellow-600'}`}>
                      {verifyResult.razorpay.status}
                    </span>
                  </p>
                  <p><span className="text-gray-500">Amount:</span> {formatPaise(verifyResult.razorpay.amount)}</p>
                  <p><span className="text-gray-500">Method:</span> {verifyResult.razorpay.method}</p>
                  <p><span className="text-gray-500">Captured:</span> {verifyResult.razorpay.captured ? 'Yes' : 'No'}</p>
                  <p><span className="text-gray-500">Refund Status:</span>{' '}
                    <span className={verifyResult.razorpay.refundStatus === 'full' ? 'text-red-600 font-medium' : ''}>
                      {verifyResult.razorpay.refundStatus ?? 'None'}
                    </span>
                  </p>
                  <p><span className="text-gray-500">Amount Refunded:</span> {formatPaise(verifyResult.razorpay.amountRefunded)}</p>
                  <p><span className="text-gray-500">Created:</span> {verifyResult.razorpay.createdAt ? new Date(verifyResult.razorpay.createdAt).toLocaleString('en-IN') : '—'}</p>
                </div>
              </div>

              {/* Match status */}
              {(() => {
                const localStatus = verifyResult.local.status;
                const rzpStatus = verifyResult.razorpay.status;
                const match =
                  (localStatus === 'SUCCESS' && rzpStatus === 'captured') ||
                  (localStatus === 'REFUNDED' && (rzpStatus === 'refunded' || verifyResult.razorpay.refundStatus === 'full')) ||
                  (localStatus === 'FAILED' && rzpStatus === 'failed');
                return (
                  <div className={`lg:col-span-2 rounded-lg p-4 text-center font-medium ${match ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {match ? 'Local and Razorpay records match' : 'MISMATCH — local and Razorpay records differ. Investigate.'}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
