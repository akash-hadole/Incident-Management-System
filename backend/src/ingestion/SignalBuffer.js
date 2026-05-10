/**
 * SignalBuffer — In-memory ring buffer with backpressure
 * Handles bursts up to 10,000 signals/sec without crashing if persistence is slow.
 * Producer writes to buffer; consumer drains asynchronously.
 */

import { EventEmitter } from 'events';

const MAX_BUFFER_SIZE = 50_000;

class SignalBuffer extends EventEmitter {
  constructor() {
    super();
    this.buffer = [];
    this.draining = false;
    this.dropped = 0;
  }

  push(signal) {
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.dropped++;
      // Backpressure: drop oldest signal (ring buffer behavior)
      this.buffer.shift();
    }
    this.buffer.push(signal);
    this.scheduleDrain();
  }

  scheduleDrain() {
    if (this.draining) return;
    this.draining = true;
    setImmediate(() => this.drain());
  }

  drain() {
    while (this.buffer.length > 0) {
      const batch = this.buffer.splice(0, 100);
      this.emit('batch', batch);
    }
    this.draining = false;
  }

  get size() { return this.buffer.length; }
  get droppedCount() { return this.dropped; }
}

export const signalBuffer = new SignalBuffer();
