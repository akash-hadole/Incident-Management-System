import { Router } from 'express';
import { WorkItemStateMachine, StateTransitionError, RCAValidationError } from '../workflow/stateMachine.js';

export const workItemRouter = Router();

// GET /api/work-items
workItemRouter.get('/', async (req, res) => {
  const { db } = req.app.locals;
  try {
    const { status, priority } = req.query;
    const items = await db.getWorkItems({ status, priority });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/work-items/:id
workItemRouter.get('/:id', async (req, res) => {
  const { db, cache } = req.app.locals;
  try {
    // Hot path — check cache first
    const cached = await cache.getWorkItem(req.params.id);
    if (cached) return res.json({ ...cached, _source: 'cache' });

    const item = await db.getWorkItemById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Work item not found' });

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/work-items/:id/status — State transition
workItemRouter.patch('/:id/status', async (req, res) => {
  const { db, cache, wss } = req.app.locals;
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: 'status is required' });

  try {
    const item = await db.getWorkItemById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Work item not found' });

    // Validate RCA exists when closing
    let rca = null;
    if (status === 'CLOSED') {
      rca = await db.getRCAByWorkItem(req.params.id);
    }

    const sm = new WorkItemStateMachine(item.status);
    sm.transition(status, { rca });

    const extra = {};
    if (status === 'CLOSED' || status === 'RESOLVED') {
      extra.endTime = new Date().toISOString();
      if (rca) {
        const { calculateMTTR } = await import('../workflow/stateMachine.js');
        extra.mttrMinutes = calculateMTTR(item.start_time, extra.endTime);
      }
    }

    const result = await db.updateWorkItemStatus(req.params.id, status, extra);
    await cache.updateWorkItemStatus(req.params.id, status);

    // Broadcast state change
    const updatedItem = result.rows[0];
    const msg = JSON.stringify({ type: 'WORK_ITEM_UPDATED', payload: updatedItem });
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });

    res.json({ success: true, workItem: updatedItem });
  } catch (err) {
    if (err instanceof StateTransitionError || err instanceof RCAValidationError) {
      return res.status(422).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});
