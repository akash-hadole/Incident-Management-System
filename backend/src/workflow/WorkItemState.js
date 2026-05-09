/**
 * State Pattern — Work Item Lifecycle
 * OPEN → INVESTIGATING → RESOLVED → CLOSED
 */

const VALID_TRANSITIONS = {
  OPEN: ['INVESTIGATING'],
  INVESTIGATING: ['RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export function canTransition(fromState, toState) {
  return (VALID_TRANSITIONS[fromState] || []).includes(toState);
}

export function validateTransition(workItem, targetState) {
  if (!canTransition(workItem.status, targetState)) {
    throw new Error(
      `Invalid transition: ${workItem.status} → ${targetState}. ` +
      `Allowed from ${workItem.status}: [${VALID_TRANSITIONS[workItem.status]?.join(', ') || 'none'}]`
    );
  }

  if (targetState === 'CLOSED') {
    const rca = workItem.rca;
    if (!rca) throw new Error('RCA is required before closing an incident.');
    if (!rca.rootCauseCategory) throw new Error('RCA must include a root cause category.');
    if (!rca.fixApplied || rca.fixApplied.trim().length < 10)
      throw new Error('RCA fix description must be at least 10 characters.');
    if (!rca.preventionSteps || rca.preventionSteps.trim().length < 10)
      throw new Error('RCA prevention steps must be at least 10 characters.');
    if (!rca.startTime || !rca.endTime)
      throw new Error('RCA must include incident start and end times.');
  }
}

export function applyTransition(workItem, targetState) {
  validateTransition(workItem, targetState);
  const now = new Date().toISOString();

  const updated = { ...workItem, status: targetState };

  if (targetState === 'INVESTIGATING') updated.investigatingAt = now;
  if (targetState === 'RESOLVED') updated.resolvedAt = now;
  if (targetState === 'CLOSED') {
    updated.closedAt = now;
    // MTTR: from first signal to RCA submission (end time)
    const start = new Date(workItem.rca.startTime).getTime();
    const end = new Date(workItem.rca.endTime).getTime();
    updated.mttrSeconds = Math.max(0, Math.round((end - start) / 1000));
  }

  return updated;
}

export const ALL_STATES = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'];
