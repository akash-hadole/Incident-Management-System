import React from 'react';
import './SignalList.css';

const SEV_COLOR = { CRITICAL: 'red', ERROR: 'orange', WARNING: 'yellow', INFO: 'accent' };

export default function SignalList({ signals }) {
  if (!signals.length) return (
    <div className="sig-empty">No signals linked to this incident yet.</div>
  );
  return (
    <div className="sig-list">
      <div className="sig-count mono">{signals.length} raw signals from NoSQL store</div>
      {signals.map((s) => (
        <div key={s.id} className="sig-item">
          <div className="sig-top">
            <span className={`sig-sev sev--${SEV_COLOR[s.severity] || 'accent'}`}>{s.severity}</span>
            <span className="sig-id mono">{s.id?.slice(0, 8)}</span>
            <span className="sig-time mono">{new Date(s.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="sig-msg">{s.message}</div>
          {Object.keys(s.metadata || {}).length > 0 && (
            <div className="sig-meta mono">{JSON.stringify(s.metadata)}</div>
          )}
        </div>
      ))}
    </div>
  );
}
