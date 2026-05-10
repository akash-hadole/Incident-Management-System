import { logger } from './logger.js';

export class MetricsCollector {
  constructor() {
    this.windowStart = Date.now();
    this.processedInWindow = 0;
    this.totalProcessed = 0;
    this.throughputHistory = []; // last 12 readings (60 seconds)
    this.reportInterval = null;
  }

  recordProcessed(count) {
    this.processedInWindow += count;
    this.totalProcessed += count;
  }

  startReporting(intervalMs = 5000) {
    this.reportInterval = setInterval(() => this._report(), intervalMs);
    logger.info('Metrics reporting started (every 5s)');
  }

  _report() {
    const now = Date.now();
    const elapsed = (now - this.windowStart) / 1000;
    const throughput = Math.round(this.processedInWindow / elapsed);

    this.throughputHistory.push({ ts: now, throughput });
    if (this.throughputHistory.length > 12) this.throughputHistory.shift();

    logger.info(
      `[METRICS] Throughput: ${throughput} signals/sec | ` +
      `Window: ${this.processedInWindow} signals | ` +
      `Total: ${this.totalProcessed}`
    );

    // Reset window
    this.processedInWindow = 0;
    this.windowStart = now;
  }

  getSnapshot() {
    const now = Date.now();
    const elapsed = Math.max((now - this.windowStart) / 1000, 1);
    return {
      currentThroughput: Math.round(this.processedInWindow / elapsed),
      totalProcessed: this.totalProcessed,
      throughputHistory: this.throughputHistory,
    };
  }

  stop() {
    if (this.reportInterval) clearInterval(this.reportInterval);
  }
}
