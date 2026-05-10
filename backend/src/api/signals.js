import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const signalRouter = Router();

const VALID_COMPONENT_TYPES = ['RDBMS', 'API', 'CACHE', 'ASYNC_QUEUE', 'NOSQL', 'MCP_HOST'];

// POST /api/signals — Ingest a signal
signalRouter.post('/', (req, res) => {
  const { db, queue, metrics } = req.app.locals;
  const body = req.body;

  if (!body.componentId || !body.componentType) {
    return res.status(400).json({ error: 'componentId and componentType are required' });
  }

  if (!VALID_COMPONENT_TYPES.includes(body.componentType)) {
    return res.status(400).json({
      error: `Invalid componentType. Valid types: ${VALID_COMPONENT_TYPES.join(', ')}`
    });
  }

  const signal = {
    id: uuidv4(),
    componentId: body.componentId,
    componentType: body.componentType,
    errorType: body.errorType || 'UNKNOWN',
    errorMessage: body.errorMessage || '',
    severity: body.severity || 'ERROR',
    metadata: body.metadata || {},
    errorRate: body.errorRate,
    queueDepth: body.queueDepth,
    receivedAt: new Date().toISOString(),
  };

  queue.enqueue(signal);
  metrics.recordProcessed(1);

  res.status(202).json({
    accepted: true,
    signalId: signal.id,
    queueSize: queue.size,
  });
});

// POST /api/signals/batch — Bulk ingest
signalRouter.post('/batch', (req, res) => {
  const { queue, metrics } = req.app.locals;
  const signals = req.body;

  if (!Array.isArray(signals)) {
    return res.status(400).json({ error: 'Body must be an array of signals' });
  }

  let accepted = 0;
  for (const s of signals) {
    if (s.componentId && s.componentType) {
      queue.enqueue({ id: uuidv4(), ...s, receivedAt: new Date().toISOString() });
      accepted++;
    }
  }

  metrics.recordProcessed(accepted);

  res.status(202).json({
    accepted,
    rejected: signals.length - accepted,
    queueSize: queue.size,
  });
});

// GET /api/signals/:workItemId — Get raw signals for a work item
signalRouter.get('/:workItemId', async (req, res) => {
  const { db } = req.app.locals;
  try {
    const signals = await db.getSignalsByWorkItem(req.params.workItemId, 100);
    res.json(signals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/signals/stats/components — Signal stats by component
signalRouter.get('/stats/components', async (req, res) => {
  const { db } = req.app.locals;
  try {
    const stats = await db.getSignalStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
