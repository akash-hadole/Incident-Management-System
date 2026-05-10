/**
 * SignalProcessor — wires SignalBuffer → DebounceEngine → Stores
 */

import { signalBuffer } from './SignalBuffer.js';
import { debounceSignal } from './DebounceEngine.js';
import {
  appendSignal,
  upsertWorkItem,
  getWorkItem,
  setCacheEntry,
  recordTimeSeriesPoint,
  incrementSignalCount,
  invalidateCache,
} from '../storage/InMemoryStore.js';
import { broadcastUpdate } from '../api/WebSocketServer.js';

async function persistWithRetry(fn, retries = 3, delayMs = 100) {
  for (let i = 0; i < retries; i++) {
    try {
      await fn();
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
}

signalBuffer.on('batch', async (batch) => {
  for (const signal of batch) {
    incrementSignalCount();
    recordTimeSeriesPoint(signal.componentId, signal.severity);

    const { workItemId, isNew } = debounceSignal(signal, (newWorkItem) => {
      persistWithRetry(() => {
        upsertWorkItem(newWorkItem);
        invalidateCache('dashboard');
        broadcastUpdate({ type: 'NEW_WORK_ITEM', workItem: newWorkItem });
      });
    });

    signal.workItemId = workItemId;

    await persistWithRetry(() => {
      appendSignal(signal.componentId, signal);
    });

    if (!isNew) {
      // Update signal count on existing work item
      const existing = getWorkItem(workItemId);
      if (existing) {
        const updated = { ...existing, signalCount: (existing.signalCount || 0) + 1 };
        upsertWorkItem(updated);
        setCacheEntry(`workitem:${workItemId}`, updated);
      }
    }
  }
});

export function ingestSignal(rawSignal) {
  signalBuffer.push(rawSignal);
}
