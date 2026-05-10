import { flushThroughput } from '../storage/InMemoryStore.js';
import { signalBuffer } from '../ingestion/SignalBuffer.js';

export function startMetricsReporter() {
  setInterval(() => {
    const rate = flushThroughput();
    const bufferSize = signalBuffer.size;
    const dropped = signalBuffer.droppedCount;
    const mem = process.memoryUsage();
    console.log(
      `[METRICS] ${new Date().toISOString()} | ` +
      `Throughput: ${rate} sig/s | ` +
      `Buffer: ${bufferSize} | ` +
      `Dropped: ${dropped} | ` +
      `Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`
    );
  }, 5000);
}
