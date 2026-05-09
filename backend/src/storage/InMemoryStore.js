/**
 * InMemoryStore — simulates NoSQL (signals), RDBMS (work items), Redis (cache), TimeSeries
 * In production, swap these with real adapters (MongoDB, PostgreSQL, Redis, InfluxDB)
 */

// ─── Raw Signal Store (Data Lake / NoSQL) ─────────────────────────────────
const signalStore = new Map(); // componentId → [signal, ...]

export function appendSignal(componentId, signal) {
  if (!signalStore.has(componentId)) signalStore.set(componentId, []);
  signalStore.get(componentId).push(signal);
}

export function getSignalsByComponent(componentId) {
  return signalStore.get(componentId) || [];
}

export function getSignalsByWorkItemId(workItemId) {
  const results = [];
  for (const signals of signalStore.values()) {
    for (const s of signals) {
      if (s.workItemId === workItemId) results.push(s);
    }
  }
  return results;
}

// ─── Work Item Store (RDBMS / Source of Truth) ────────────────────────────
const workItems = new Map(); // workItemId → workItem

export function upsertWorkItem(workItem) {
  // Simulated transactional write
  workItems.set(workItem.id, { ...workItem, updatedAt: new Date().toISOString() });
}

export function getWorkItem(id) {
  return workItems.get(id) || null;
}

export function getAllWorkItems() {
  return [...workItems.values()].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

// ─── Dashboard Cache (Redis hot-path) ─────────────────────────────────────
const dashboardCache = new Map();

export function setCacheEntry(key, value, ttlMs = 5000) {
  dashboardCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function getCacheEntry(key) {
  const entry = dashboardCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    dashboardCache.delete(key);
    return null;
  }
  return entry.value;
}

export function invalidateCache(key) {
  dashboardCache.delete(key);
}

// ─── Time-Series Aggregations ──────────────────────────────────────────────
const timeSeries = []; // [{timestamp, componentId, severity, count}]

export function recordTimeSeriesPoint(componentId, severity) {
  timeSeries.push({ timestamp: new Date().toISOString(), componentId, severity, count: 1 });
}

export function getTimeSeries(windowMs = 60_000) {
  const cutoff = Date.now() - windowMs;
  return timeSeries.filter((p) => new Date(p.timestamp).getTime() > cutoff);
}

// ─── Throughput Metrics ────────────────────────────────────────────────────
let signalCount = 0;
let windowStart = Date.now();

export function incrementSignalCount() { signalCount++; }

export function flushThroughput() {
  const elapsed = (Date.now() - windowStart) / 1000;
  const rate = (signalCount / elapsed).toFixed(1);
  signalCount = 0;
  windowStart = Date.now();
  return parseFloat(rate);
}
