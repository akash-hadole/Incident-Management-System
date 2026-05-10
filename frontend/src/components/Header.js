import React from 'react';
import './Header.css';

const WS_LABELS = { connected: 'LIVE', disconnected: 'OFFLINE', connecting: 'CONNECTING', error: 'ERROR' };

export default function Header({ wsStatus, metrics }) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-icon">⬡</span>
          <div>
            <div className="logo-title">IMS</div>
            <div className="logo-sub">INCIDENT MANAGEMENT SYSTEM</div>
          </div>
        </div>
      </div>
      <div className="header-center">
        <div className="header-stat">
          <div className="stat-value mono">{(metrics.signalsPerSec || 0).toFixed(1)}</div>
          <div className="stat-label">SIG/SEC</div>
        </div>
        <div className="header-divider" />
        <div className="header-stat">
          <div className="stat-value mono">{new Date().toLocaleTimeString()}</div>
          <div className="stat-label">LOCAL TIME</div>
        </div>
      </div>
      <div className="header-right">
        <div className={`ws-badge ws-badge--${wsStatus}`}>
          <span className="ws-dot" />
          {WS_LABELS[wsStatus]}
        </div>
      </div>
    </header>
  );
}
