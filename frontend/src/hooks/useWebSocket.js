import { useEffect, useRef, useCallback } from 'react';

export function useWebSocket(url, onMessage) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => console.log('[WS] Connected');
      ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch (_) {} };
      ws.onclose = () => { reconnectTimer.current = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    } catch (_) { reconnectTimer.current = setTimeout(connect, 3000); }
  }, [url, onMessage]);
  useEffect(() => {
    connect();
    return () => { clearTimeout(reconnectTimer.current); wsRef.current?.close(); };
  }, [connect]);
}
