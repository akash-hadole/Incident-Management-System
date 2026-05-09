const { randomUUID } = require('crypto');
const signalBuffer = require('./signalBuffer');
const db = require('../storage/inMemoryDB');
const { createAlertStrategy } = require('../workflow/alertingStrategy');
const { WorkItemStateMachine, STATES } = require('../workflow/workItemStateMachine');
const wsServer = require('../observability/wsServer');

signalBuffer.on('batch', async (batch) => {
  for (const signal of batch) {
    try { await processSignal(signal); }
    catch (err) { console.error('[Processor] Error:', err.message); }
  }
});

async function processSignal(signal) {
  const { componentId } = signal;
  const { create } = signalBuffer.checkDebounce(componentId);
  let workItemId = signalBuffer.getWorkItemForComponent(componentId);

  if (create || !workItemId) {
    const strategy = createAlertStrategy(componentId);
    const alert = strategy.getAlert(signal);
    const priority = strategy.getPriority();
    const workItem = {
      id:            randomUUID(),
      componentId,
      title:         `Incident: ${componentId} – ${signal.errorCode || 'Failure'}`,
      status:        STATES.OPEN,
      priority:      priority.level,
      priorityLabel: priority.label,
      priorityColor: priority.color,
      alertMessage:  alert.message,
      signalCount:   1,
      createdAt:     new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
      startTime:     signal.receivedAt ? new Date(signal.receivedAt).toISOString() : new Date().toISOString(),
    };
    db.createWorkItem(workItem);
    workItemId = workItem.id;
    signalBuffer.setWorkItemForComponent(componentId, workItemId);
    wsServer.broadcast({ type: 'WORK_ITEM_CREATED', payload: workItem });
  } else {
    const existing = db.getWorkItem(workItemId);
    if (existing) db.updateWorkItem(workItemId, { signalCount: (existing.signalCount || 1) + 1 });
  }

  const rawSignal = {
    id:          randomUUID(),
    workItemId,
    componentId,
    errorCode:   signal.errorCode || 'UNKNOWN',
    severity:    signal.severity || 'ERROR',
    message:     signal.message || '',
    metadata:    signal.metadata || {},
    receivedAt:  signal.receivedAt ? new Date(signal.receivedAt).toISOString() : new Date().toISOString(),
  };
  db.appendSignal(rawSignal);
  wsServer.broadcast({ type: 'SIGNAL_INGESTED', payload: { workItemId, signalId: rawSignal.id } });
}

module.exports = { processSignal };
