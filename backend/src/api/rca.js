import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { WorkItemStateMachine, RCAValidationError, calculateMTTR } from '../workflow/stateMachine.js';

export const rcaRouter = Router();

const ROOT_CAUSE_CATEGORIES = [
  'Infrastructure Failure',
  'Software Bug',
  'Configuration Error',
  'Capacity / Overload',
  'Third-party Dependency',
  'Network Partition',
  'Human Error',
  'Security Incident',
  'Data Corruption',
  'Unknown',
];

// GET /api/rca/categories
rcaRouter.get('/categories', (req, res) => {
  res.json(ROOT_CAUSE_CATEGORIES);
});

// GET /api/rca/:workItemId
rcaRouter.get('/:workItemId', async (req, res) => {
  const { db } = req.app.locals;
  try {
    const rca = await db.getRCAByWorkItem(req.params.workItemId);
    if (!rca) return res.status(404).json({ error: 'RCA not found for this work item' });
    res.json(rca);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rca — Submit RCA
rcaRouter.post('/', async (req, res) => {
  const { db, cache, wss } = req.app.locals;
  const { workItemId, rootCauseCategory, fixApplied, preventionSteps, incidentStart, incidentEnd } = req.body;

  const rca = { rootCauseCategory, fixApplied, preventionSteps, incidentStart, incidentEnd };

  try {
    // Validate using state machine RCA validator
    const sm = new WorkItemStateMachine('RESOLVED');
    sm.transition('CLOSED', { rca });
  } catch (err) {
    if (err instanceof RCAValidationError) {
      return res.status(422).json({ error: err.message, code: err.code });
    }
  }

  try {
    const item = await db.getWorkItemById(workItemId);
    if (!item) return res.status(404).json({ error: 'Work item not found' });

    const existing = await db.getRCAByWorkItem(workItemId);
    if (existing) return res.status(409).json({ error: 'RCA already exists for this work item' });

    const mttrMinutes = calculateMTTR(incidentStart, incidentEnd);

    const rcaRecord = {
      id: uuidv4(),
      workItemId,
      rootCauseCategory,
      fixApplied,
      preventionSteps,
      incidentStart,
      incidentEnd,
      mttrMinutes,
    };

    await db.createRCA(rcaRecord);

    // Broadcast RCA creation
    const msg = JSON.stringify({ type: 'RCA_SUBMITTED', payload: { workItemId, mttrMinutes } });
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });

    res.status(201).json({ success: true, rca: rcaRecord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
