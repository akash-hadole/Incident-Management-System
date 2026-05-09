import express from 'express';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { ingestSignal } from '../ingestion/SignalProcessor.js';
import {
  getAllWorkItems,
  getWorkItem,
  upsertWorkItem,
  getSignalsByWorkItemId,
  getCacheEntry,
  setCacheEntry,
  invalidateCache,
  getTimeSeries,
  flushThroughput,
} from '../storage/InMemoryStore.js';
import { applyTransition } from '../workflow/WorkItemState.js';
import { broadcastUpdate } from './WebSocketServer.js';
import { signalBuffer } from '../ingestion/SignalBuffer.js';

const router = express.Router();

// ─── Rate Limiter: Ingestion ──────────────────────────────────────────────
const ingestionLimiter = rateLimit({
  windowMs: 1000,
  max: 5000,
  message: { error: 'Rate limit exceeded on ingestion endpoint' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /api/signals — Ingest a signal ─────────────────────────────────
router.post('/signals', ingestionLimiter, (req, res) => {
  const body = req.body;
  if (!body.componentId || !body.componentType) {
    return res.status(400).json({ error: 'componentId and componentType are required' });
  }

  const signal = {
    id: uuidv4(),
    componentId: body.componentId,
    componentType: body.componentType,
    message: body.message || 'Unknown error',
    severity: body.severity || 'ERROR',
    metadata: body.metadata || {},
    timestamp: new Date().toISOString(),
  };

  ingestSignal(signal);
  res.status(202).json({ status: 'accepted', signalId: signal.id });
});

// ─── GET /api/workitems — List all work items ────────────────────────────
router.get('/workitems', (req, res) => {
  const cached = getCacheEntry('dashboard');
  if (cached) return res.json(cached);

  const items = getAllWorkItems();
  setCacheEntry('dashboard', items, 5000);
  res.json(items);
});

// ─── GET /api/workitems/:id — Get single work item ───────────────────────
router.get('/workitems/:id', (req, res) => {
  const cached = getCacheEntry(`workitem:${req.params.id}`);
  if (cached) return res.json(cached);

  const item = getWorkItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Work item not found' });

  setCacheEntry(`workitem:${req.params.id}`, item);
  res.json(item);
});

// ─── GET /api/workitems/:id/signals — Signals for a work item ────────────
router.get('/workitems/:id/signals', (req, res) => {
  const signals = getSignalsByWorkItemId(req.params.id);
  res.json(signals);
});

// ─── PATCH /api/workitems/:id/transition — State transition ──────────────
router.patch('/workitems/:id/transition', (req, res) => {
  const { targetState } = req.body;
  if (!targetState) return res.status(400).json({ error: 'targetState is required' });

  const workItem = getWorkItem(req.params.id);
  if (!workItem) return res.status(404).json({ error: 'Work item not found' });

  try {
    const updated = applyTransition(workItem, targetState);
    upsertWorkItem(updated);
    invalidateCache('dashboard');
    invalidateCache(`workitem:${workItem.id}`);
    broadcastUpdate({ type: 'WORK_ITEM_UPDATED', workItem: updated });
    res.json(updated);
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// ─── PUT /api/workitems/:id/rca — Submit RCA ─────────────────────────────
router.put('/workitems/:id/rca', (req, res) => {
  const workItem = getWorkItem(req.params.id);
  if (!workItem) return res.status(404).json({ error: 'Work item not found' });

  const { rootCauseCategory, fixApplied, preventionSteps, startTime, endTime } = req.body;
  const rca = { rootCauseCategory, fixApplied, preventionSteps, startTime, endTime, submittedAt: new Date().toISOString() };

  const updated = { ...workItem, rca };
  upsertWorkItem(updated);
  invalidateCache('dashboard');
  invalidateCache(`workitem:${workItem.id}`);
  broadcastUpdate({ type: 'RCA_SUBMITTED', workItem: updated });
  res.json(updated);
});

// ─── GET /api/timeseries — Aggregated time series ────────────────────────
router.get('/timeseries', (req, res) => {
  const windowMs = parseInt(req.query.windowMs) || 60_000;
  res.json(getTimeSeries(windowMs));
});

// ─── GET /health ─────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bufferSize: signalBuffer.size,
    droppedSignals: signalBuffer.droppedCount,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/metrics — Throughput ───────────────────────────────────────
router.get('/metrics', (req, res) => {
  res.json({ signalsPerSec: flushThroughput(), timestamp: new Date().toISOString() });
});

export default router;
