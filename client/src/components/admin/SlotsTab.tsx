import { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import type { Facility } from '@strikers/shared';

export function SlotsTab() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [capacity, setCapacity] = useState(1);
  const [timeSlots, setTimeSlots] = useState([{ startTime: '06:00', endTime: '07:00' }]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Block form
  const [blockFacilityId, setBlockFacilityId] = useState('');
  const [blockDate, setBlockDate] = useState('');
  const [blockReason, setBlockReason] = useState('Rain');
  const [blockMsg, setBlockMsg] = useState<string | null>(null);

  useEffect(() => {
    adminApi.listFacilities().then(setFacilities).catch(console.error);
  }, []);

  const addTimeSlot = () => {
    const last = timeSlots[timeSlots.length - 1];
    const nextStart = last.endTime;
    const [h, m] = nextStart.split(':').map(Number);
    const nextEnd = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setTimeSlots([...timeSlots, { startTime: nextStart, endTime: nextEnd }]);
  };

  const removeTimeSlot = (idx: number) => {
    setTimeSlots(timeSlots.filter((_, i) => i !== idx));
  };

  const updateTimeSlot = (idx: number, field: 'startTime' | 'endTime', value: string) => {
    setTimeSlots(timeSlots.map((ts, i) => (i === idx ? { ...ts, [field]: value } : ts)));
  };

  const handleBulkCreate = async () => {
    if (!facilityId || !startDate || !endDate || timeSlots.length === 0) {
      setResult('Please fill all fields');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const res = await adminApi.bulkCreateSlots({ facilityId, startDate, endDate, timeSlots, capacity });
      setResult(`Created ${res.created} slots (${res.skipped} duplicates skipped)`);
    } catch (err) {
      setResult(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlock = async () => {
    if (!blockDate || !blockReason) { setBlockMsg('Date and reason are required'); return; }
    try {
      await adminApi.blockSlots({
        facilityId: blockFacilityId || undefined,
        date: blockDate,
        reason: blockReason,
      });
      setBlockMsg('Slots blocked successfully');
      setBlockDate('');
    } catch (err) {
      setBlockMsg(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Bulk Create */}
      <div className="card space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Bulk Create Slots</h3>

        <div>
          <label className="label">Facility</label>
          <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)} className="input">
            <option value="">Select facility</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>{f.name} ({f.type})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
          </div>
        </div>

        <div>
          <label className="label">Capacity per Slot</label>
          <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value) || 1)} className="input w-24" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Time Slots</label>
            <button onClick={addTimeSlot} className="text-xs text-brand-600 hover:underline">+ Add slot</button>
          </div>
          <div className="space-y-2">
            {timeSlots.map((ts, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="time"
                  value={ts.startTime}
                  onChange={(e) => updateTimeSlot(i, 'startTime', e.target.value)}
                  className="input w-auto"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="time"
                  value={ts.endTime}
                  onChange={(e) => updateTimeSlot(i, 'endTime', e.target.value)}
                  className="input w-auto"
                />
                {timeSlots.length > 1 && (
                  <button onClick={() => removeTimeSlot(i)} className="text-red-500 text-xs hover:underline">Remove</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleBulkCreate} disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Creating...' : 'Create Slots'}
        </button>
        {result && <p className="text-sm text-gray-600">{result}</p>}
      </div>

      {/* Block Slots */}
      <div className="card space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Block Slots</h3>
        <p className="text-xs text-gray-500">Block slots for rain, holidays, or maintenance</p>

        <div>
          <label className="label">Facility (optional — leave blank for all)</label>
          <select value={blockFacilityId} onChange={(e) => setBlockFacilityId(e.target.value)} className="input">
            <option value="">All facilities</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Date</label>
          <input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} className="input" />
        </div>

        <div>
          <label className="label">Reason</label>
          <select value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="input">
            <option value="Rain">Rain</option>
            <option value="Holiday">Holiday</option>
            <option value="Maintenance">Maintenance</option>
          </select>
        </div>

        <button onClick={handleBlock} className="btn-primary w-full">Block Slots</button>
        {blockMsg && <p className="text-sm text-gray-600">{blockMsg}</p>}
      </div>
    </div>
  );
}
