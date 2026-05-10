import { v4 as uuidv4 } from 'uuid';
import { logger } from '../observability/logger.js';
import { AlertingStrategyFactory } from '../workflow/alerting.js';
import { WorkItemStateMachine } from '../workflow/stateMachine.js';

const DEBOUNCE_WINDOW_MS = 10000; // 10 seconds
const DEBOUNCE_THRESHOLD = 100;   // 100 signals → 1 work item
const PROCESS_INTERVAL_MS = 50;   // Process batch every 50ms

/**
 * SignalProcessor — Async processor that drains the queue
 * Implements debouncing: 100 signals/component/10s → 1 WorkItem
 */
export class SignalProcessor {
  constructor({ db, cache, metrics, queue, wss }) {
    this.db = db;
    this.cache = cache;
    this.metrics = metrics;
    this.queue = queue;
    this.wss = wss;

    // Debounce map: componentId → { workItemId, signals[], firstSeen, timer }
    this.debounceMap = new Map();
    this.running = false;
    this.intervalHandle = null;
  }

  start() {
    this.running = true;
    this.intervalHandle = setInterval(() => this._processBatch(), PROCESS_INTERVAL_MS);
    logger.info('Signal processor started');
  }

  stop() {
    this.running = false;
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    logger.info('Signal processor stopped');
  }

  async _processBatch() {
    const batch = this.queue.dequeueBatch(500);
    if (!batch.length) return;

    this.metrics.recordProcessed(batch.length);

    // Group by componentId for debounce evaluation
    const byComponent = new Map();
    for (const signal of batch) {
      const cid = signal.componentId;
      if (!byComponent.has(cid)) byComponent.set(cid, []);
      byComponent.get(cid).push(signal);
    }

    const promises = [];
    for (const [componentId, signals] of byComponent) {
      promises.push(this._handleComponentSignals(componentId, signals));
    }

    await Promise.allSettled(promises);
  }

  async _handleComponentSignals(componentId, newSignals) {
    const now = Date.now();

    if (!this.debounceMap.has(componentId)) {
      this.debounceMap.set(componentId, {
        workItemId: null,
        signals: [],
        firstSeen: now,
      });
    }

    const state = this.debounceMap.get(componentId);
    state.signals.push(...newSignals);

    const windowElapsed = now - state.firstSeen;
    const shouldCreateWorkItem =
      state.signals.length >= DEBOUNCE_THRESHOLD ||
      (windowElapsed >= DEBOUNCE_WINDOW_MS && state.signals.length > 0 && !state.workItemId);

    if (shouldCreateWorkItem && !state.workItemId) {
      await this._createWorkItem(componentId, state, newSignals[0]);
    } else if (state.workItemId) {
      // Link additional signals to existing work item
      await this._linkSignalsToWorkItem(state.workItemId, newSignals);
    }

    // Persist raw signals to MongoDB (data lake)
    await this._persistRawSignals(newSignals, state.workItemId);

    // Reset debounce window after threshold
    if (windowElapsed >= DEBOUNCE_WINDOW_MS) {
      state.firstSeen = now;
      state.signals = [];
      if (state.workItemId) {
        state.workItemId = null; // Allow new work item next window
      }
    }
  }

  async _createWorkItem(componentId, state, representativeSignal) {
    const strategy = AlertingStrategyFactory.getStrategy(representativeSignal.componentType);
    const priority = strategy.getPriority(representativeSignal);
    const alerts = strategy.getAlertChannels(representativeSignal);

    const workItem = {
      id: uuidv4(),
      componentId,
      componentType: representativeSignal.componentType,
      title: `[${priority}] ${componentId} — ${representativeSignal.errorType}`,
      priority,
      status: 'OPEN',
      alertChannels: alerts,
      signalCount: state.signals.length,
      startTime: new Date(state.firstSeen).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await this.db.createWorkItem(workItem);
      state.workItemId = workItem.id;

      // Update cache for real-time dashboard
      await this.cache.setWorkItem(workItem);
      await this.cache.incrementActiveCount();

      // Broadcast to WebSocket clients
      this._broadcast({ type: 'WORK_ITEM_CREATED', payload: workItem });

      logger.info(`WorkItem created: ${workItem.id} for ${componentId} (${priority})`);
    } catch (err) {
      logger.error(`Failed to create work item for ${componentId}:`, err);
    }
  }

  async _linkSignalsToWorkItem(workItemId, signals) {
    try {
      await this.db.incrementSignalCount(workItemId, signals.length);
      await this.cache.incrementSignalCount(workItemId, signals.length);
    } catch (err) {
      logger.warn(`Failed to link signals to ${workItemId}:`, err);
    }
  }

  async _persistRawSignals(signals, workItemId) {
    const docs = signals.map(s => ({
      ...s,
      workItemId,
      storedAt: new Date().toISOString(),
    }));
    try {
      await this.db.insertSignals(docs);
    } catch (err) {
      logger.warn('Failed to persist raw signals:', err);
    }
  }

  _broadcast(message) {
    const data = JSON.stringify(message);
    this.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(data);
      }
    });
  }
}
