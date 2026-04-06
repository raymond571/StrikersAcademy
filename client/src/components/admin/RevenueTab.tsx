import { useState } from 'react';
import { adminApi, type RevenueReport } from '../../services/api';

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export function RevenueTab() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [from, setFrom] = useState(weekAgo);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const r = await adminApi.revenueReport({ from, to });
      setReport(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto" />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-auto" />
        </div>
        <button onClick={fetchReport} disabled={loading} className="btn-primary">
          {loading ? 'Loading...' : 'Generate Report'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {report && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="card">
              <p className="text-sm text-gray-500">Gross Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatPaise(report.totalRevenue)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Refunds</p>
              <p className="text-2xl font-bold text-orange-500">{formatPaise(report.totalRefunds)} ({report.totalRefundCount})</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Net Revenue</p>
              <p className="text-2xl font-bold text-emerald-600">{formatPaise(report.netRevenue)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Online Payments</p>
              <p className="text-2xl font-bold text-green-600">{formatPaise(report.totalOnline)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Offline Payments</p>
              <p className="text-2xl font-bold text-blue-600">{formatPaise(report.totalOffline)}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">Total Transactions</p>
              <p className="text-2xl font-bold text-gray-900">{report.totalPayments}</p>
            </div>
          </div>

          {/* Daily breakdown */}
          {report.daily.length > 0 ? (
            <div className="card overflow-x-auto">
              <h3 className="text-base font-semibold mb-3">Daily Breakdown</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4 text-right">Revenue</th>
                    <th className="pb-2 pr-4 text-right">Refunds</th>
                    <th className="pb-2 pr-4 text-right">Net</th>
                    <th className="pb-2 pr-4 text-right">Online</th>
                    <th className="pb-2 pr-4 text-right">Offline</th>
                    <th className="pb-2 text-right">Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {report.daily.map((d) => (
                    <tr key={d.date} className="border-b border-gray-100">
                      <td className="py-2 pr-4 text-gray-900">{d.date}</td>
                      <td className="py-2 pr-4 text-right font-medium">{formatPaise(d.revenue)}</td>
                      <td className="py-2 pr-4 text-right text-orange-500">{d.refunds ? formatPaise(d.refunds) : '—'}</td>
                      <td className="py-2 pr-4 text-right font-medium text-emerald-600">{formatPaise(d.revenue - d.refunds)}</td>
                      <td className="py-2 pr-4 text-right text-green-600">{formatPaise(d.online)}</td>
                      <td className="py-2 pr-4 text-right text-blue-600">{formatPaise(d.offline)}</td>
                      <td className="py-2 text-right">{d.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No transactions in this period</p>
          )}
        </>
      )}
    </div>
  );
}
