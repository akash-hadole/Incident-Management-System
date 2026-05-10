import React, { useState, useEffect } from 'react';
import RCAForm from './RCAForm';
import SignalList from './SignalList';
import './IncidentDetail.css';

const API = 'http://localhost:4000/api';

const TRANSITIONS = {
  OPEN: 'INVESTIGATING',
  INVESTIGATING: 'RESOLVED',
  RESOLVED: 'CLOSED',
  CLOSED: null,
};

const STEP_MAP = { OPEN: 0, INVESTIGATING: 1, RESOLVED: 2, CLOSED: 3 };
const STEPS = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'];

function formatMTTR(secs) {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

export default function IncidentDetail({ workItem, onClose, onUpdate, addToast }) {
  const [signals, setSignals] = useState([]);
  const [transitioning, setTransitioning] = useState(false);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    fetch(`${API}/workitems/${workItem.id}/signals`)
      .then((r) => r.json())
      .then(setSignals)
      .catch(() => {});
  }, [workItem.id, workItem.signalCount]);

  const transition = async () => {
    const target = TRANSITIONS[workItem.status];
    if (!target) return;
    if (target === 'CLOSED' && !workItem.rca) {
      addToast('Submit RCA first before closing!', 'error');
      setTab('rca');
      return;
    }
    setTransitioning(true);
    try {
      const res = await fetch(`${API}/workitems/${workItem.id}/transition`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetState: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdate(data);
      addToast(`Moved to ${target}`, 'success');
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setTransitioning(false);
    }
  };

  const nextState = TRANSITIONS[workItem.status];
  const step = STEP_MAP[workItem.status];

  return (
    <div className="detail">
      <div className="detail-header">
        <div className="detail-header-top">
          <div>
            <div className="detail-id mono">#{workItem.id.slice(0, 8).toUpperCase()}</div>
            <div className="detail-title">{workItem.componentId}</div>
            <div className="detail-alert-msg">{workItem.alertMessage}</div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="stepper">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`step ${i <= step ? 'step--done' : ''} ${i === step ? 'step--active' : ''}`}>
                <div className="step-dot">{i < step ? '✓' : i + 1}</div>
                <div className="step-label">{s}</div>
              </div>
              {i < STEPS.length - 1 && <div className={`step-line ${i < step ? 'step-line--done' : ''}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="detail-meta">
          <div className="meta-item">
            <span className="meta-label">PRIORITY</span>
            <span className={`meta-val p--${workItem.priority}`}>{workItem.priorityLabel}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">SIGNALS</span>
            <span className="meta-val mono accent">{workItem.signalCount}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">MTTR</span>
            <span className="meta-val mono">{formatMTTR(workItem.mttrSeconds)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">ESCALATE TO</span>
            <span className="meta-val">{(workItem.escalateTo || []).join(', ')}</span>
          </div>
        </div>

        {nextState && (
          <button
            className={`transition-btn ${nextState === 'CLOSED' ? 'transition-btn--close' : ''}`}
            onClick={transition}
            disabled={transitioning}
          >
            {transitioning ? '...' : `→ Move to ${nextState}`}
          </button>
        )}
      </div>

      <div className="detail-tabs">
        {['overview', 'signals', 'rca'].map((t) => (
          <button key={t} className={`tab ${tab === t ? 'tab--active' : ''}`} onClick={() => setTab(t)}>
            {t.toUpperCase()}
            {t === 'rca' && workItem.rca && <span className="tab-dot" />}
          </button>
        ))}
      </div>

      <div className="detail-body">
        {tab === 'overview' && (
          <div className="overview-grid">
            <InfoBlock label="Component ID" value={workItem.componentId} mono />
            <InfoBlock label="Component Type" value={workItem.componentType} mono />
            <InfoBlock label="Status" value={workItem.status} />
            <InfoBlock label="Created" value={new Date(workItem.createdAt).toLocaleString()} mono />
            {workItem.investigatingAt && <InfoBlock label="Investigating Since" value={new Date(workItem.investigatingAt).toLocaleString()} mono />}
            {workItem.resolvedAt && <InfoBlock label="Resolved At" value={new Date(workItem.resolvedAt).toLocaleString()} mono />}
            {workItem.closedAt && <InfoBlock label="Closed At" value={new Date(workItem.closedAt).toLocaleString()} mono />}
            {workItem.mttrSeconds && <InfoBlock label="MTTR" value={formatMTTR(workItem.mttrSeconds)} mono />}
          </div>
        )}
        {tab === 'signals' && <SignalList signals={signals} />}
        {tab === 'rca' && (
          <RCAForm workItem={workItem} onUpdate={onUpdate} addToast={addToast} />
        )}
      </div>
    </div>
  );
}

function InfoBlock({ label, value, mono }) {
  return (
    <div className="info-block">
      <div className="info-label">{label}</div>
      <div className={`info-value ${mono ? 'mono' : ''}`}>{value}</div>
    </div>
  );
}
