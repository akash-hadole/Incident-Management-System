import React, { useState, useEffect, useCallback, useRef } from 'react';
import Dashboard from './components/Dashboard';
import IncidentDetail from './components/IncidentDetail';
import Header from './components/Header';
import SignalSimulator from './components/SignalSimulator';
import './App.css';

const API = 'http://localhost:4000/api';
const WS_URL = 'ws://localhost:4000';

export default function App() {
  const [workItems, setWorkItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [metrics, setMetrics] = useState({ signalsPerSec: 0 });
  const [wsStatus, setWsStatus] = useState('connecting');
  const [toasts, setToasts] = useState([]);
  const wsRef = useRef(null);

  const addToast = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const fetchWorkItems = useCallback(async () => {
    try {
      const res = await fetch(`${API}/workitems`);
      const data = await res.json();
      setWorkItems(data);
    } catch { /* silent */ }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API}/metrics`);
      const data = await res.json();
      setMetrics(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchWorkItems();
    fetchMetrics();
    const metricsInterval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(metricsInterval);
  }, [fetchWorkItems, fetchMetrics]);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => setWsStatus('connected');
      ws.onclose = () => { setWsStatus('disconnected'); setTimeout(connect, 3000); };
      ws.onerror = () => setWsStatus('error');
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'NEW_WORK_ITEM') {
          setWorkItems((prev) => [data.workItem, ...prev]);
          addToast(`New incident: ${data.workItem.componentId}`, 'warning');
        } else if (data.type === 'WORK_ITEM_UPDATED' || data.type === 'RCA_SUBMITTED') {
          setWorkItems((prev) => prev.map((w) => w.id === data.workItem.id ? data.workItem : w));
        }
      };
    };
    connect();
    return () => wsRef.current?.close();
  }, [addToast]);

  const selectedItem = workItems.find((w) => w.id === selectedId);

  return (
    <div className="app">
      <Header wsStatus={wsStatus} metrics={metrics} />
      <div className="app-body">
        <Dashboard
          workItems={workItems}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRefresh={fetchWorkItems}
        />
        {selectedItem && (
          <IncidentDetail
            workItem={selectedItem}
            onClose={() => setSelectedId(null)}
            onUpdate={(updated) => {
              setWorkItems((prev) => prev.map((w) => w.id === updated.id ? updated : w));
            }}
            addToast={addToast}
          />
        )}
      </div>
      <SignalSimulator addToast={addToast} onSignalSent={fetchWorkItems} />
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
