/**
 * Signal Buffer – in-memory ring buffer for backpressure handling
 * Handles bursts of up to 10,000 signals/sec without crashing
 */

const { EventEmitter } = require('events');

const MAX_BUFFER_SIZE = 50000;
const FLUSH_INTERVAL_MS = 100; // flush every 100ms
const DEBOUNCE_WINDOW_MS = 10000; // 10-second debounce window
const DEBOUNCE_THRESHOLD = 100;   // 100 signals per component

class SignalBuffer extends EventEmitter {
  constructor() {
    super();
    this.buffer = [];
    this.debounceMap = new Map(); // componentId → { count, firstSeen, timeoutId }
    this.dropped = 0;
    this.processed = 0;
    this.processingRate = 0;
    this._startFlushLoop();
    this._startMetricsLoop();
  }

  /**
   * Enqueue a signal. Returns { accepted, debounced, workItemId? }
   */
  enqueue(signal) {
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.dropped++;
      return { accepted: false, reason: 'buffer_full' };
    }
    this.buffer.push({ ...signal, receivedAt: Date.now() });
    return { accepted: true };
  }

  /**
   * Debounce check: should this signal create a new Work Item?
   * Returns { create: bool, entry }
   */
  checkDebounce(componentId) {
    const now = Date.now();
    let entry = this.debounceMap.get(componentId);

    if (!entry || (now - entry.firstSeen) > DEBOUNCE_WINDOW_MS) {
      // New window
      if (entry?.timeoutId) clearTimeout(entry.timeoutId);
      entry = {
        count: 1,
        firstSeen: now,
        shouldCreate: true,
        workItemId: null,
        timeoutId: setTimeout(() => this.debounceMap.delete(componentId), DEBOUNCE_WINDOW_MS + 1000),
      };
      this.debounceMap.set(componentId, entry);
      return { create: true, entry };
    }

    entry.count++;
    entry.shouldCreate = entry.count <= 1;
    return { create: false, entry };
  }

  setWorkItemForComponent(componentId, workItemId) {
    const entry = this.debounceMap.get(componentId);
    if (entry) entry.workItemId = workItemId;
  }

  getWorkItemForComponent(componentId) {
    return this.debounceMap.get(componentId)?.workItemId || null;
  }

  _startFlushLoop() {
    this._flushInterval = setInterval(() => {
      const batch = this.buffer.splice(0, 500); // drain up to 500 per tick
      if (batch.length > 0) {
        this.processed += batch.length;
        this.emit('batch', batch);
      }
    }, FLUSH_INTERVAL_MS);
  }

  _startMetricsLoop() {
    let lastProcessed = 0;
    this._metricsInterval = setInterval(() => {
      const delta = this.processed - lastProcessed;
      this.processingRate = delta / 5;
      lastProcessed = this.processed;
      const metrics = {
        bufferSize: this.buffer.length,
        totalProcessed: this.processed,
        dropped: this.dropped,
        signalsPerSec: this.processingRate.toFixed(1),
        activeComponents: this.debounceMap.size,
      };
      console.log(`[METRICS] ${JSON.stringify(metrics)}`);
      this.emit('metrics', metrics);
    }, 5000);
  }

  getStats() {
    return {
      bufferSize: this.buffer.length,
      totalProcessed: this.processed,
      dropped: this.dropped,
      signalsPerSec: this.processingRate,
      activeComponents: this.debounceMap.size,
    };
  }

  destroy() {
    clearInterval(this._flushInterval);
    clearInterval(this._metricsInterval);
  }
}

module.exports = new SignalBuffer(); // singleton
