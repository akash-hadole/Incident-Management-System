import React, { useMemo } from 'react';
import './Dashboard.css';

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
const STATUS_COLOR = { OPEN: 'red', INVESTIGATING: 'orange', RESOLVED: 'yellow', CLOSED: 'green' };
const PRIORITY_COLOR = { P0: 'red', P1: 'orange', P2: 'yellow', P3: 'accent' };

function formatAge(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

export default function Dashboard({ workItems, selectedId, onSelect, onRefresh }) {
  const sorted = useMemo(() =>
    [...workItems].sort((a, b) => {
      const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pd !== 0) return pd;
      return new Date(b.createdAt) - new Date(a.createdAt);
    }), [workItems]);

  const stats = useMemo(() => ({
    total: workItems.length,
    open: workItems.filter((w) => w.status === 'OPEN').length,
    p0: workItems.filter((w) => w.priority === 'P0').length,
    resolved: workItems.filter((w) => w.status === 'CLOSED').length,
  }), [workItems]);

  return (
    <aside className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-title">ACTIVE INCIDENTS</div>
        <button className="refresh-btn" onClick={onRefresh} title="Refresh">↺</button>
      </div>

      <div className="stats-row">
        <div className="stat-pill stat-pill--total"><span>{stats.total}</span>TOTAL</div>
        <div className="stat-pill stat-pill--open"><span>{stats.open}</span>OPEN</div>
        <div className="stat-pill stat-pill--p0"><span>{stats.p0}</span>P0</div>
        <div className="stat-pill stat-pill--closed"><span>{stats.resolved}</span>CLOSED</div>
      </div>

      <div className="incident-list">
        {sorted.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <div>All systems operational</div>
            <div className="empty-sub">No active incidents</div>
          </div>
        )}
        {sorted.map((item) => (
          <div
            key={item.id}
            className={`incident-card ${selectedId === item.id ? 'incident-card--active' : ''} priority--${PRIORITY_COLOR[item.priority]}`}
            onClick={() => onSelect(item.id)}
          >
            <div className="card-top">
              <span className={`priority-badge p--${item.priority}`}>{item.priority}</span>
              <span className={`status-badge s--${STATUS_COLOR[item.status]}`}>{item.status}</span>
            </div>
            <div className="card-component">{item.componentId}</div>
            <div className="card-type mono">{item.componentType}</div>
            <div className="card-bottom">
              <span className="card-signals">⚡ {item.signalCount} signals</span>
              <span className="card-age">{formatAge(item.createdAt)}</span>
            </div>
            {item.status === 'OPEN' && item.priority === 'P0' && (
              <div className="card-alert-strip" />
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
