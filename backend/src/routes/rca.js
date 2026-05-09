const { v4: uuidv4 } = require('./uuid-lite');
const db = require('../storage/inMemoryDB');
const { WorkItemStateMachine } = require('../workflow/workItemStateMachine');
const wsServer = require('../observability/wsServer');

const ROOT_CAUSE_CATEGORIES = [
  'Infrastructure Failure','Software Bug','Configuration Error',
  'Capacity Exhaustion','Network Partition','Data Corruption',
  'Third-Party Dependency','Human Error','Unknown',
];

module.exports = function rcaRoutes({ pathname, query, method, body, sendJSON }) {
  if (pathname === '/api/rca/categories' && method === 'GET') {
    return sendJSON(200, ROOT_CAUSE_CATEGORIES);
  }

  const match = pathname.match(/^\/api\/rca\/([^/]+)$/);
  if (!match) return sendJSON(404, { error: 'Not found' });
  const workItemId = match[1];

  if (method === 'POST') {
    const item = db.getWorkItem(workItemId);
    if (!item) return sendJSON(404, { error: 'Work item not found' });
    const { rootCauseCategory, fixApplied, preventionSteps, incidentStart, incidentEnd } = body;
    const required = { rootCauseCategory, fixApplied, preventionSteps, incidentStart, incidentEnd };
    const missing = Object.entries(required).filter(([, v]) => !v?.trim?.()).map(([k]) => k);
    if (missing.length) return sendJSON(400, { error: `Missing: ${missing.join(', ')}` });
    if (new Date(incidentEnd) <= new Date(incidentStart))
      return sendJSON(400, { error: 'incidentEnd must be after incidentStart' });
    const mttr = WorkItemStateMachine.calculateMTTR(incidentStart, incidentEnd);
    const rcaRecord = { id: uuidv4(), workItemId, rootCauseCategory, fixApplied, preventionSteps, incidentStart, incidentEnd, mttr, submittedAt: new Date().toISOString() };
    db.saveRCA(rcaRecord);
    db.updateWorkItem(workItemId, { mttr: mttr?.display });
    wsServer.broadcast({ type: 'RCA_SUBMITTED', payload: rcaRecord });
    return sendJSON(201, rcaRecord);
  }

  if (method === 'GET') {
    const rca = db.getRCA(workItemId);
    if (!rca) return sendJSON(404, { error: 'RCA not found' });
    return sendJSON(200, rca);
  }

  sendJSON(405, { error: 'Method not allowed' });
};
