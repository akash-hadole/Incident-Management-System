import React, { useState } from 'react';
import './SignalSimulator.css';

const API = 'http://localhost:4000/api';

const SCENARIOS = [
  {
    label: '🔴 RDBMS Outage',
    signals: [
      { componentId: 'RDBMS_PRIMARY', componentType: 'RDBMS', message: 'Connection pool exhausted', severity: 'CRITICAL' },
      { componentId: 'RDBMS_PRIMARY', componentType: 'RDBMS', message: 'Write timeout after 30s', severity: 'CRITICAL' },
      { componentId: 'RDBMS_PRIMARY', componentType: 'RDBMS', message: 'Replication lag > 10s', severity: 'ERROR' },
    ],
  },
  {
    label: '🟠 MCP + Cache Cascade',
    signals: [
      { componentId: 'MCP_HOST_01', componentType: 'MCP', message: 'Health check failed', severity: 'ERROR' },
      { componentId: 'CACHE_CLUSTER_01', componentType: 'CACHE', message: 'Eviction rate spike', severity: 'WARNING' },
      { componentId: 'CACHE_CLUSTER_01', componentType: 'CACHE', message: 'Hit rate dropped to 12%', severity: 'ERROR' },
      { componentId: 'MCP_HOST_01', componentType: 'MCP', message: 'Request queue overflow', severity: 'CRITICAL' },
    ],
  },
  {
    label: '🟡 Queue Backup',
    signals: [
      { componentId: 'ASYNC_QUEUE_01', componentType: 'QUEUE', message: 'Dead letter queue growing', severity: 'WARNING' },
      { componentId: 'ASYNC_QUEUE_01', componentType: 'QUEUE', message: 'Consumer lag: 50k messages', severity: 'ERROR' },
    ],
  },
  {
    label: '🟠 API Degradation',
    signals: [
      { componentId: 'API_GATEWAY_01', componentType: 'API', message: 'P99 latency > 5s', severity: 'ERROR' },
      { componentId: 'API_GATEWAY_01', componentType: 'API', message: 'Error rate 23%', severity: 'CRITICAL' },
      { componentId: 'NOSQL_CLUSTER', componentType: 'NOSQL', message: 'Shard unavailable', severity: 'ERROR' },
    ],
  },
];

export default function SignalSimulator({ addToast, onSignalSent }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [custom, setCustom] = useState({ componentId: '', componentType: 'API', message: '', severity: 'ERROR' });

  const sendScenario = async (scenario) => {
    setSending(true);
    try {
      for (const s of scenario.signals) {
        await fetch(`${API}/signals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(s),
        });
        await new Promise((r) => setTimeout(r, 50));
      }
      addToast(`Scenario fired: ${scenario.label}`, 'warning');
      setTimeout(onSignalSent, 500);
    } catch {
      addToast('Failed to send scenario', 'error');
    } finally {
      setSending(false);
    }
  };

  const sendCustom = async () => {
    if (!custom.componentId || !custom.message) {
      addToast('Fill in component ID and message', 'error');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${API}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(custom),
      });
      if (!res.ok) throw new Error('Failed');
      addToast(`Signal sent: ${custom.componentId}`, 'info');
      setTimeout(onSignalSent, 500);
    } catch {
      addToast('Failed to send signal', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button className="sim-fab" onClick={() => setOpen(!open)} title="Signal Simulator">
        {open ? '✕' : '⚡'}
      </button>
      {open && (
        <div className="sim-panel">
          <div className="sim-header">
            <span className="sim-title mono">SIGNAL SIMULATOR</span>
          </div>
          <div className="sim-body">
            <div className="sim-section-label">SCENARIOS</div>
            <div className="sim-scenarios">
              {SCENARIOS.map((s) => (
                <button key={s.label} className="sim-scenario-btn" onClick={() => sendScenario(s)} disabled={sending}>
                  {s.label}
                  <span className="sim-count">{s.signals.length} signals</span>
                </button>
              ))}
            </div>

            <div className="sim-section-label">CUSTOM SIGNAL</div>
            <div className="sim-custom">
              <input
                className="sim-input"
                placeholder="Component ID (e.g. RDBMS_01)"
                value={custom.componentId}
                onChange={(e) => setCustom((c) => ({ ...c, componentId: e.target.value }))}
              />
              <select className="sim-input" value={custom.componentType} onChange={(e) => setCustom((c) => ({ ...c, componentType: e.target.value }))}>
                {['API', 'MCP', 'CACHE', 'QUEUE', 'RDBMS', 'NOSQL'].map((t) => <option key={t}>{t}</option>)}
              </select>
              <select className="sim-input" value={custom.severity} onChange={(e) => setCustom((c) => ({ ...c, severity: e.target.value }))}>
                {['INFO', 'WARNING', 'ERROR', 'CRITICAL'].map((s) => <option key={s}>{s}</option>)}
              </select>
              <input
                className="sim-input"
                placeholder="Error message"
                value={custom.message}
                onChange={(e) => setCustom((c) => ({ ...c, message: e.target.value }))}
              />
              <button className="sim-send-btn" onClick={sendCustom} disabled={sending}>
                {sending ? '...' : 'FIRE →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
