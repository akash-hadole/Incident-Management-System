/**
 * In-Memory Database (Source of Truth for Work Items)
 * Simulates transactional RDBMS behaviour
 */

class InMemoryDB {
  constructor() {
    // Work Items table
    this.workItems = new Map();
    // RCA table
    this.rcaRecords = new Map();
    // Signals table (NoSQL-style, raw audit log)
    this.signals = [];
    // Time-series aggregations
    this.timeSeries = [];
    // Dashboard cache (hot-path)
    this.dashboardCache = null;
    this.cacheExpiry = 0;
    this.CACHE_TTL_MS = 5000;
  }

  // ── Work Items ──────────────────────────────────────────
  createWorkItem(item) {
    this.workItems.set(item.id, { ...item });
    this.invalidateCache();
    return item;
  }

  getWorkItem(id) {
    return this.workItems.get(id) || null;
  }

  getAllWorkItems() {
    return Array.from(this.workItems.values());
  }

  updateWorkItem(id, patch) {
    const existing = this.workItems.get(id);
    if (!existing) throw new Error(`WorkItem ${id} not found`);
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.workItems.set(id, updated);
    this.invalidateCache();
    return updated;
  }

  // ── RCA Records ─────────────────────────────────────────
  saveRCA(rcaRecord) {
    this.rcaRecords.set(rcaRecord.workItemId, rcaRecord);
    this.invalidateCache();
    return rcaRecord;
  }

  getRCA(workItemId) {
    return this.rcaRecords.get(workItemId) || null;
  }

  // ── Raw Signals (NoSQL / Data Lake) ─────────────────────
  appendSignal(signal) {
    this.signals.push(signal);
    this._recordTimeSeries(signal);
  }

  getSignalsByWorkItem(workItemId) {
    return this.signals.filter(s => s.workItemId === workItemId);
  }

  getAllSignals() {
    return this.signals;
  }

  getSignalCount() {
    return this.signals.length;
  }

  // ── Time Series ─────────────────────────────────────────
  _recordTimeSeries(signal) {
    const bucket = Math.floor(Date.now() / 5000) * 5000; // 5-sec buckets
    const last = this.timeSeries[this.timeSeries.length - 1];
    if (last && last.ts === bucket) {
      last.count++;
    } else {
      this.timeSeries.push({ ts: bucket, count: 1, component: signal.componentId });
    }
    if (this.timeSeries.length > 720) this.timeSeries.shift(); // keep ~1hr
  }

  getTimeSeries(limit = 60) {
    return this.timeSeries.slice(-limit);
  }

  // ── Dashboard Cache (Hot-Path) ───────────────────────────
  getDashboardCache() {
    if (this.dashboardCache && Date.now() < this.cacheExpiry) {
      return this.dashboardCache;
    }
    return null;
  }

  setDashboardCache(data) {
    this.dashboardCache = data;
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
  }

  invalidateCache() {
    this.dashboardCache = null;
    this.cacheExpiry = 0;
  }
}

module.exports = new InMemoryDB(); // singleton
