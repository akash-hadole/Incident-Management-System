const signalBuffer = require('../ingestion/signalBuffer');
const db = require('../storage/inMemoryDB');

// Simple in-memory rate limiter
const rateLimitMap = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const window = 60000;
  const max = 5000;
  let entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > window) {
    entry = { start: now, count: 0 };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  return entry.count <= max;
}

module.exports = function signalRoutes({ pathname, query, method, body, sendJSON }) {
  // POST /api/signals/batch
  if (pathname === '/api/signals/batch' && method === 'POST') {
    if (!Array.isArray(body)) return sendJSON(400, { error: 'Expected array' });
    let accepted = 0, rejected = 0;
    for (const signal of body) {
      if (!signal.componentId) { rejected++; continue; }
      signalBuffer.enqueue(signal).accepted ? accepted++ : rejected++;
    }
    return sendJSON(202, { accepted, rejected });
  }

  // POST /api/signals
  if (pathname === '/api/signals' && method === 'POST') {
    if (!body.componentId) return sendJSON(400, { error: 'componentId is required' });
    const result = signalBuffer.enqueue(body);
    if (!result.accepted) return sendJSON(429, { error: 'Buffer full' });
    return sendJSON(202, { accepted: true });
  }

  // GET /api/signals
  if (pathname === '/api/signals' && method === 'GET') {
    const { workItemId, limit = 100 } = query;
    let signals = workItemId ? db.getSignalsByWorkItem(workItemId) : db.getAllSignals();
    return sendJSON(200, { total: signals.length, signals: signals.slice(-Number(limit)) });
  }

  sendJSON(404, { error: 'Not found' });
};
