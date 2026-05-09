import React, { useState } from 'react';
import './RCAForm.css';

const API = 'http://localhost:4000/api';

const ROOT_CAUSE_CATEGORIES = [
  'DB_FAILURE', 'NETWORK_PARTITION', 'MEMORY_LEAK', 'CPU_EXHAUSTION',
  'DISK_FULL', 'CONFIG_ERROR', 'DEPENDENCY_FAILURE', 'CACHE_EVICTION',
  'QUEUE_OVERFLOW', 'CERTIFICATE_EXPIRY', 'DEPLOYMENT_ISSUE', 'UNKNOWN',
];

export default function RCAForm({ workItem, onUpdate, addToast }) {
  const existing = workItem.rca;
  const [form, setForm] = useState({
    startTime: existing?.startTime || workItem.createdAt?.slice(0, 16) || '',
    endTime: existing?.endTime || '',
    rootCauseCategory: existing?.rootCauseCategory || '',
    fixApplied: existing?.fixApplied || '',
    preventionSteps: existing?.preventionSteps || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/workitems/${workItem.id}/rca`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdate(data);
      addToast('RCA saved successfully', 'success');
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const isClosed = workItem.status === 'CLOSED';

  return (
    <div className="rca-form">
      {existing && (
        <div className="rca-badge">
          <span className="rca-badge-dot" />
          RCA submitted {new Date(existing.submittedAt).toLocaleString()}
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">INCIDENT START TIME</label>
          <input
            type="datetime-local"
            className="form-input"
            value={form.startTime}
            onChange={set('startTime')}
            disabled={isClosed}
          />
        </div>
        <div className="form-group">
          <label className="form-label">INCIDENT END TIME</label>
          <input
            type="datetime-local"
            className="form-input"
            value={form.endTime}
            onChange={set('endTime')}
            disabled={isClosed}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">ROOT CAUSE CATEGORY</label>
        <select className="form-input" value={form.rootCauseCategory} onChange={set('rootCauseCategory')} disabled={isClosed}>
          <option value="">— Select a category —</option>
          {ROOT_CAUSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">FIX APPLIED</label>
        <textarea
          className="form-input form-textarea"
          rows={4}
          placeholder="Describe exactly what was done to resolve the incident..."
          value={form.fixApplied}
          onChange={set('fixApplied')}
          disabled={isClosed}
        />
      </div>

      <div className="form-group">
        <label className="form-label">PREVENTION STEPS</label>
        <textarea
          className="form-input form-textarea"
          rows={4}
          placeholder="How will we prevent this from happening again?"
          value={form.preventionSteps}
          onChange={set('preventionSteps')}
          disabled={isClosed}
        />
      </div>

      {!isClosed && (
        <button className="rca-submit-btn" onClick={submit} disabled={saving}>
          {saving ? 'Saving...' : existing ? 'Update RCA' : 'Submit RCA'}
        </button>
      )}

      {isClosed && workItem.mttrSeconds && (
        <div className="mttr-display">
          <div className="mttr-label">MEAN TIME TO REPAIR</div>
          <div className="mttr-value">
            {Math.floor(workItem.mttrSeconds / 3600)}h {Math.floor((workItem.mttrSeconds % 3600) / 60)}m {workItem.mttrSeconds % 60}s
          </div>
        </div>
      )}
    </div>
  );
}
