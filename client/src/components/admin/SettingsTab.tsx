import { useEffect, useState } from 'react';
import { adminApi } from '../../services/api';

export function SettingsTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getSettings()
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const updated = await adminApi.updateSettings(settings);
      setSettings(updated);
      setMsg('Settings saved!');
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) return <p className="text-sm text-gray-500">Loading settings...</p>;

  const fields = [
    { key: 'cancellation_charge_percent', label: 'Cancellation Charge (%)', type: 'number', help: 'Percentage deducted from refund on cancellation (0 = free cancellation)' },
    { key: 'academy_name', label: 'Academy Name', type: 'text' },
    { key: 'academy_address', label: 'Address', type: 'text' },
    { key: 'academy_phone', label: 'Phone', type: 'text' },
    { key: 'academy_email', label: 'Email', type: 'text' },
    { key: 'academy_gst', label: 'GST Number', type: 'text', help: 'Leave empty if not applicable' },
  ];

  return (
    <div className="space-y-6 max-w-xl">
      {msg && (
        <div className={`rounded-lg p-3 text-sm ${msg.includes('saved') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg}
        </div>
      )}

      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
          <input
            type={f.type}
            value={settings[f.key] ?? ''}
            onChange={(e) => update(f.key, e.target.value)}
            className="input w-full"
            {...(f.type === 'number' ? { min: 0, max: 100, step: 1 } : {})}
          />
          {f.help && <p className="text-xs text-gray-400 mt-1">{f.help}</p>}
        </div>
      ))}

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
