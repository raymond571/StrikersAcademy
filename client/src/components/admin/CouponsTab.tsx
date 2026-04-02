import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../../services/api';
import type { Coupon } from '@strikers/shared';

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

function formatDiscount(coupon: Coupon) {
  if (coupon.discountType === 'FIXED') return formatPaise(coupon.discountValue);
  return `${(coupon.discountValue / 100).toFixed(1)}%`;
}

export function CouponsTab() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Create form state
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [discountValue, setDiscountValue] = useState('');
  const [maxUsage, setMaxUsage] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.listCoupons();
      setCoupons(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const handleCreate = async () => {
    setFormError(null);
    if (!code || !discountValue) { setFormError('Code and discount value are required'); return; }

    try {
      await adminApi.createCoupon({
        code,
        description: description || undefined,
        discountType,
        discountValue: parseInt(discountValue, 10),
        maxUsage: maxUsage ? parseInt(maxUsage, 10) : undefined,
        validFrom,
        validUntil: validUntil || undefined,
      });
      setShowForm(false);
      setCode(''); setDescription(''); setDiscountValue(''); setMaxUsage(''); setValidUntil('');
      fetchCoupons();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      await adminApi.updateCoupon(coupon.id, { isActive: !coupon.isActive });
      fetchCoupons();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading coupons...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Coupons</h3>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs">
          {showForm ? 'Cancel' : '+ New Coupon'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card space-y-3">
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Code</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="input" placeholder="WELCOME20" />
            </div>
            <div>
              <label className="label">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Optional" />
            </div>
            <div>
              <label className="label">Type</label>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'FIXED' | 'PERCENT')} className="input">
                <option value="FIXED">Fixed (paise)</option>
                <option value="PERCENT">Percent (basis points)</option>
              </select>
            </div>
            <div>
              <label className="label">Value {discountType === 'FIXED' ? '(paise)' : '(basis pts, 1000=10%)'}</label>
              <input type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Max Usage (optional)</label>
              <input type="number" value={maxUsage} onChange={(e) => setMaxUsage(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Valid From</label>
              <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Valid Until (optional)</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="input" />
            </div>
          </div>
          <button onClick={handleCreate} className="btn-primary">Create Coupon</button>
        </div>
      )}

      {/* Coupon list */}
      {coupons.length === 0 ? (
        <p className="text-sm text-gray-500">No coupons yet</p>
      ) : (
        <div className="space-y-3">
          {coupons.map((c) => (
            <div key={c.id} className={`card flex items-center justify-between ${!c.isActive ? 'opacity-50' : ''}`}>
              <div className="min-w-0">
                <p className="font-mono font-bold text-gray-900">{c.code}</p>
                {c.description && <p className="text-sm text-gray-600">{c.description}</p>}
                <p className="text-xs text-gray-400">
                  {formatDiscount(c)} off &middot; Used: {c.usedCount}{c.maxUsage ? `/${c.maxUsage}` : ''} &middot;
                  From: {new Date(c.validFrom).toLocaleDateString('en-IN')}
                  {c.validUntil ? ` to ${new Date(c.validUntil).toLocaleDateString('en-IN')}` : ''}
                </p>
              </div>
              <button
                onClick={() => toggleActive(c)}
                className={`rounded px-3 py-1 text-xs font-medium ${
                  c.isActive
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {c.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
