import React, { useState } from 'react';
import { api } from '../utils/api';

const SCENARIOS = [
  { label: 'RDBMS Outage (P0)', signals: [
    { componentId: 'RDBMS_PRIMARY', errorCode: 'CONNECTION_POOL_EXHAUSTED', severity: 'CRITICAL', message: 'Primary DB pool exhausted' },
    { componentId: 'RDBMS_PRIMARY', errorCode: 'DEADLOCK_DETECTED', severity: 'CRITICAL', message: 'Deadlock in transactions' },
  ]},
  { label: 'API Gateway Cascade (P1)', signals: [
    { componentId: 'API_GATEWAY', errorCode: 'UPSTREAM_TIMEOUT', severity: 'ERROR', message: 'Upstream DB timeout' },
    { componentId: 'API_GATEWAY', errorCode: 'CIRCUIT_OPEN', severity: 'ERROR', message: 'Circuit breaker opened' },
  ]},
  { label: 'Cache Pressure (P2)', signals: [
    { componentId: 'CACHE_CLUSTER_01', errorCode: 'EVICTION_STORM', severity: 'WARNING', message: 'Eviction rate 10x normal' },
    { componentId: 'CACHE_CLUSTER_01', errorCode: 'MEMORY_PRESSURE', severity: 'WARNING', message: 'Memory at 94%' },
  ]},
  { label: 'Full Stack Cascade', signals: [
    { componentId: 'RDBMS_PRIMARY', errorCode: 'OUTAGE', severity: 'CRITICAL', message: 'Database unreachable' },
    { componentId: 'MCP_HOST_01', errorCode: 'CONTEXT_FETCH_FAILED', severity: 'ERROR', message: 'Cannot reach DB' },
    { componentId: 'API_GATEWAY', errorCode: 'SERVICE_DEGRADED', severity: 'ERROR', message: 'Multiple upstreams down' },
    { componentId: 'ASYNC_QUEUE_01', errorCode: 'BACKLOG_SPIKE', severity: 'WARNING', message: 'Queue backing up' },
    { componentId: 'NOSQL_STORE_01', errorCode: 'WRITE_THROTTLED', severity: 'WARNING', message: 'Writes throttled' },
  ]},
];

const COMPONENT_TYPES = ['RDBMS_PRIMARY', 'RDBMS_REPLICA', 'API_GATEWAY', 'MCP_HOST_01', 'MCP_HOST_02', 'CACHE_CLUSTER_01', 'CACHE_CLUSTER_02', 'ASYNC_QUEUE_01', 'NOSQL_STORE_01'];
const ERROR_CODES = ['CONNECTION_REFUSED', 'TIMEOUT', 'DEADLOCK_DETECTED', 'MEMORY_PRESSURE', 'HIGH_LATENCY', 'CIRCUIT_OPEN', 'EVICTION_STORM', 'REPLICATION_LAG'];

export default function SimulatorPanel({ onClose, showToast }) {
  const [running, setRunning] = useState(null);
  const [custom, setCustom] = useState({ componentId: COMPONENT_TYPES[0], errorCode: ERROR_CODES[0], severity: 'ERROR', message: '' });
  const [burst, setBurst] = useState(10);

  const runScenario = async (scenario) => {
    setRunning(scenario.label);
    try {
      const res = await api.sendBatch(scenario.signals);
      showToast(`Sent ${res.accepted} signals for ${scenario.label}`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
    setRunning(null);
  };

  const sendCustom = async () => {
    setRunning('custom');
    try {
      await api.sendSignal(custom);
      showToast(`Signal sent: ${custom.componentId}`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
    setRunning(null);
  };

  const sendBurst = async () => {
    setRunning('burst');
    const signals = Array.from({ length: Number(burst) }, (_, i) => ({
      componentId: custom.componentId, errorCode: custom.errorCode,
      severity: custom.severity, message: `Burst signal #${i+1}`,
    }));
    try {
      const res = await api.sendBatch(signals);
      showToast(`Burst: ${res.accepted} signals accepted`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
    setRunning(null);
  };

  const SELECT_STYLE = {
    width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 4, color: 'var(--text-primary)', padding: '8px 10px', fontSize: 12,
    fontFamily: 'var(--font-mono)', outline: 'none',
  };

  return (
    <div style={{
      width: 320, flexShrink: 0, background: 'var(--bg-panel)',
      borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', color: 'var(--accent-blue)' }}>⚡ FAILURE SIMULATOR</span>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', width: 28, height: 28, borderRadius: 4, fontSize: 14 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Scenarios */}
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>SCENARIOS <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SCENARIOS.map(s => (
              <button key={s.label} onClick={() => runScenario(s)} disabled={!!running} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', borderRadius: 4, padding: '10px 12px',
                textAlign: 'left', fontSize: 12, fontFamily: 'var(--font-mono)',
                opacity: running && running !== s.label ? 0.5 : 1,
                transition: 'all 0.15s', cursor: running ? 'not-allowed' : 'pointer',
              }}>
                {running === s.label ? '▶ RUNNING...' : `▷ ${s.label}`}
                <span style={{ float: 'right', color: 'var(--text-muted)', fontSize: 10 }}>{s.signals.length} signals</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom */}
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>CUSTOM SIGNAL <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select value={custom.componentId} onChange={e => setCustom(p => ({...p, componentId: e.target.value}))} style={SELECT_STYLE}>
              {COMPONENT_TYPES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={custom.errorCode} onChange={e => setCustom(p => ({...p, errorCode: e.target.value}))} style={SELECT_STYLE}>
              {ERROR_CODES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={custom.severity} onChange={e => setCustom(p => ({...p, severity: e.target.value}))} style={SELECT_STYLE}>
              {['CRITICAL','ERROR','WARNING','INFO'].map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={sendCustom} disabled={!!running} style={{
              background: 'var(--accent-blue)', color: '#fff', border: 'none',
              padding: '8px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11,
              opacity: running ? 0.6 : 1,
            }}>
              SEND SIGNAL
            </button>
          </div>
        </div>

        {/* Burst */}
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>BURST TEST <div style={{ flex: 1, height: 1, background: 'var(--border)' }}/></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={burst} min={1} max={500} onChange={e => setBurst(e.target.value)}
              style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', padding: '8px', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none' }} />
            <button onClick={sendBurst} disabled={!!running} style={{
              background: 'var(--p1)', color: '#fff', border: 'none',
              padding: '8px 16px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11,
              opacity: running ? 0.6 : 1, whiteSpace: 'nowrap',
            }}>
              {running === 'burst' ? 'SENDING...' : 'BURST'}
            </button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
            Sends {burst} signals to trigger debounce logic
          </div>
        </div>
      </div>
    </div>
  );
}
