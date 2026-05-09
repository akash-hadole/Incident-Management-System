/**
 * SignalIngestionQueue — Ring-buffer-style in-memory queue
 * Handles bursts of 10,000 signals/sec without crashing if DB is slow.
 * Implements backpressure by dropping oldest signals when at capacity.
 */
export class SignalIngestionQueue {
  constructor({ maxSize = 100000 } = {}) {
    this.queue = [];
    this.maxSize = maxSize;
    this.droppedCount = 0;
    this.totalEnqueued = 0;
  }

  enqueue(signal) {
    if (this.queue.length >= this.maxSize) {
      // Backpressure: drop oldest to protect memory
      this.queue.shift();
      this.droppedCount++;
    }
    this.queue.push({ ...signal, enqueuedAt: Date.now() });
    this.totalEnqueued++;
    return true;
  }

  dequeueBatch(size = 500) {
    return this.queue.splice(0, size);
  }

  get size() {
    return this.queue.length;
  }

  get stats() {
    return {
      queueSize: this.queue.length,
      maxSize: this.maxSize,
      droppedCount: this.droppedCount,
      totalEnqueued: this.totalEnqueued,
      utilizationPct: Math.round((this.queue.length / this.maxSize) * 100),
    };
  }
}
