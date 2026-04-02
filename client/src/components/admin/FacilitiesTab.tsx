import { useEffect, useState, useCallback } from 'react';
import { facilityApi, adminApi, type FacilityTypeItem } from '../../services/api';
import type { Facility } from '@strikers/shared';

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

type Section = 'facilities' | 'types';

interface FacilityForm {
  name: string;
  type: string;
  description: string;
  pricePerSlot: string;
}

const emptyForm: FacilityForm = { name: '', type: '', description: '', pricePerSlot: '' };

export function FacilitiesTab() {
  const [section, setSection] = useState<Section>('facilities');
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [types, setTypes] = useState<FacilityTypeItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Facility form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FacilityForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Type form
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState({ name: '', label: '', description: '' });
  const [typeError, setTypeError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [f, t] = await Promise.all([facilityApi.list(), adminApi.listFacilityTypes()]);
      setFacilities(f);
      setTypes(t);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Facility CRUD ──────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, type: types.find((t) => t.isActive)?.name ?? '' });
    setError(null);
    setShowForm(true);
  };

  const openEdit = (f: Facility) => {
    setEditingId(f.id);
    setForm({ name: f.name, type: f.type, description: f.description, pricePerSlot: String(f.pricePerSlot) });
    setError(null);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.pricePerSlot || !form.type) { setError('Name, type, and price are required'); return; }
    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        await facilityApi.update(editingId, {
          name: form.name,
          type: form.type as 'NET' | 'TURF',
          description: form.description,
          pricePerSlot: parseInt(form.pricePerSlot, 10),
        });
      } else {
        await facilityApi.create({
          name: form.name,
          type: form.type as 'NET' | 'TURF',
          description: form.description || undefined,
          pricePerSlot: parseInt(form.pricePerSlot, 10),
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (f: Facility) => {
    try {
      await facilityApi.update(f.id, { isActive: !f.isActive });
      fetchAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  // ── Type CRUD ──────────────────────────────────────────────

  const openTypeCreate = () => {
    setEditingTypeId(null);
    setTypeForm({ name: '', label: '', description: '' });
    setTypeError(null);
    setShowTypeForm(true);
  };

  const openTypeEdit = (t: FacilityTypeItem) => {
    setEditingTypeId(t.id);
    setTypeForm({ name: t.name, label: t.label, description: t.description });
    setTypeError(null);
    setShowTypeForm(true);
  };

  const handleTypeSubmit = async () => {
    if (!typeForm.label) { setTypeError('Label is required'); return; }
    if (!editingTypeId && !typeForm.name) { setTypeError('Name is required'); return; }
    setTypeError(null);
    try {
      if (editingTypeId) {
        await adminApi.updateFacilityType(editingTypeId, {
          label: typeForm.label,
          description: typeForm.description,
        });
      } else {
        await adminApi.createFacilityType({
          name: typeForm.name,
          label: typeForm.label,
          description: typeForm.description || undefined,
        });
      }
      setShowTypeForm(false);
      setEditingTypeId(null);
      setTypeForm({ name: '', label: '', description: '' });
      fetchAll();
    } catch (err) {
      setTypeError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const toggleTypeActive = async (t: FacilityTypeItem) => {
    try {
      await adminApi.updateFacilityType(t.id, { isActive: !t.isActive });
      fetchAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  const deleteType = async (t: FacilityTypeItem) => {
    if (!confirm(`Delete type "${t.label}"? This only works if no facilities use it.`)) return;
    try {
      await adminApi.deleteFacilityType(t.id);
      fetchAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed');
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;

  const activeTypes = types.filter((t) => t.isActive);

  return (
    <div className="space-y-4">
      {/* Section switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setSection('facilities')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            section === 'facilities' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Facilities
        </button>
        <button
          onClick={() => setSection('types')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            section === 'types' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Manage Types
        </button>
      </div>

      {/* ── Facilities Section ───────────────────── */}
      {section === 'facilities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Facilities</h3>
            <button onClick={openCreate} className="btn-primary text-xs">+ Add Facility</button>
          </div>

          {showForm && (
            <div className="card space-y-4">
              <h4 className="font-medium text-gray-900">{editingId ? 'Edit Facility' : 'New Facility'}</h4>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Net Lane 1" />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
                    <option value="">Select type</option>
                    {activeTypes.map((t) => (
                      <option key={t.name} value={t.name}>{t.label} ({t.name})</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" rows={3} placeholder="Bowling machine net lane — suitable for all skill levels" />
                </div>
                <div>
                  <label className="label">Price per Slot (paise, e.g. 50000 = ₹500)</label>
                  <input type="number" value={form.pricePerSlot} onChange={(e) => setForm({ ...form, pricePerSlot: e.target.value })} className="input" placeholder="50000" min={0} />
                  {form.pricePerSlot && <p className="text-xs text-gray-400 mt-1">= {formatPaise(parseInt(form.pricePerSlot, 10) || 0)}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSubmit} disabled={submitting} className="btn-primary">{submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
                <button onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {facilities.length === 0 ? (
            <p className="text-sm text-gray-500">No facilities yet</p>
          ) : (
            <div className="space-y-3">
              {facilities.map((f) => (
                <div key={f.id} className={`card ${!f.isActive ? 'opacity-50' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900">{f.name}</p>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{f.type}</span>
                        {!f.isActive && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Inactive</span>}
                      </div>
                      {f.description && <p className="text-sm text-gray-500 mt-1">{f.description}</p>}
                      <p className="text-sm font-medium text-brand-600 mt-1">{formatPaise(f.pricePerSlot)} / slot</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => openEdit(f)} className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">Edit</button>
                      <button onClick={() => toggleActive(f)} className={`rounded px-3 py-1 text-xs font-medium ${f.isActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                        {f.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Manage Types Section ─────────────────── */}
      {section === 'types' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Facility Types</h3>
            <button onClick={openTypeCreate} className="btn-primary text-xs">+ Add Type</button>
          </div>

          {showTypeForm && (
            <div className="card space-y-4">
              <h4 className="font-medium text-gray-900">{editingTypeId ? 'Edit Type' : 'New Type'}</h4>
              {typeError && <p className="text-sm text-red-500">{typeError}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Name (uppercase code, e.g. BOWLING_MACHINE)</label>
                  <input
                    value={typeForm.name}
                    onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                    className="input"
                    placeholder="BOWLING_MACHINE"
                    disabled={!!editingTypeId}
                  />
                  {editingTypeId && <p className="text-xs text-gray-400 mt-1">Name cannot be changed after creation</p>}
                </div>
                <div>
                  <label className="label">Display Label</label>
                  <input value={typeForm.label} onChange={(e) => setTypeForm({ ...typeForm, label: e.target.value })} className="input" placeholder="Bowling Machine" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Description</label>
                  <textarea value={typeForm.description} onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })} className="input" rows={2} placeholder="Optional description of this facility type" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleTypeSubmit} className="btn-primary">{editingTypeId ? 'Update' : 'Create'}</button>
                <button onClick={() => { setShowTypeForm(false); setEditingTypeId(null); }} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          {types.length === 0 ? (
            <p className="text-sm text-gray-500">No types defined yet</p>
          ) : (
            <div className="space-y-3">
              {types.map((t) => {
                const usedBy = facilities.filter((f) => f.type === t.name).length;
                return (
                  <div key={t.id} className={`card ${!t.isActive ? 'opacity-50' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-mono font-bold text-gray-900">{t.name}</p>
                          <span className="text-sm text-gray-600">{t.label}</span>
                          {!t.isActive && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">Inactive</span>}
                        </div>
                        {t.description && <p className="text-sm text-gray-500 mt-1">{t.description}</p>}
                        <p className="text-xs text-gray-400 mt-1">Used by {usedBy} facility(ies)</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => openTypeEdit(t)} className="rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">Edit</button>
                        <button onClick={() => toggleTypeActive(t)} className={`rounded px-3 py-1 text-xs font-medium ${t.isActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                          {t.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => deleteType(t)} className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700">Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
