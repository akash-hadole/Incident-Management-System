export function wsManager(wss, { db, cache }) {
  wss.on('connection', async (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Send current dashboard state on connect
    try {
      const items = await db.getWorkItems({ limit: 20 });
      ws.send(JSON.stringify({ type: 'INITIAL_STATE', payload: items }));
    } catch {}

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'PING') ws.send(JSON.stringify({ type: 'PONG' }));
      } catch {}
    });
  });

  // Heartbeat
  const interval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));
}
