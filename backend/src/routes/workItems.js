const db = require('../storage/inMemoryDB');
const { WorkItemStateMachine, STATES } = require('../workflow/workItemStateMachine');
const wsServer = require('../observability/wsServer');

module.exports = function workItemRoutes({ pathname, query, method, body, sendJSON }) {
  // GET /api/work-items
  if (pathname === '/api/work-items' && method === 'GET') {
    const cached = db.getDashboardCache();
    if (cached) return sendJSON(200, { fromCache: true, ...cached });
    const items = db.getAllWorkItems().sort((a, b) => {
      const p = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return (p[a.priority] ?? 9) - (p[b.priority] ?? 9);
    });
    const result = { total: items.length, workItems: items };
    db.setDashboardCache(result);
    return sendJSON(200, { fromCache: false, ...result });
  }

  // PATCH /api/work-items/:id/transition
  const transitionMatch = pathname.match(/^\/api\/work-items\/([^/]+)\/transition$/);
  if (transitionMatch && method === 'PATCH') {
    const id = transitionMatch[1];
    const { nextState } = body;
    if (!nextState) return sendJSON(400, { error: 'nextState required' });
    const item = db.getWorkItem(id);
    if (!item) return sendJSON(404, { error: 'Work item not found' });
    try {
      const sm = new WorkItemStateMachine(item.status);
      const rca = nextState === STATES.CLOSED ? db.getRCA(id) : null;
      sm.transition(nextState, rca);
      const updated = db.updateWorkItem(id, { status: nextState });
      wsServer.broadcast({ type: 'WORK_ITEM_UPDATED', payload: updated });
      return sendJSON(200, updated);
    } catch (err) {
      return sendJSON(422, { error: err.message });
    }
  }

  // GET /api/work-items/:id
  const idMatch = pathname.match(/^\/api\/work-items\/([^/]+)$/);
  if (idMatch && method === 'GET') {
    const item = db.getWorkItem(idMatch[1]);
    if (!item) return sendJSON(404, { error: 'Work item not found' });
    const signals = db.getSignalsByWorkItem(item.id);
    const rca = db.getRCA(item.id);
    return sendJSON(200, { ...item, signals, rca });
  }

  sendJSON(404, { error: 'Not found' });
};
