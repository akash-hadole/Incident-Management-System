/**
 * WorkItem State Machine (State Pattern)
 * Valid transitions: OPEN → INVESTIGATING → RESOLVED → CLOSED
 * CLOSED requires a complete RCA object.
 */

const TRANSITIONS = {
  OPEN: ['INVESTIGATING'],
  INVESTIGATING: ['RESOLVED', 'OPEN'],
  RESOLVED: ['CLOSED', 'INVESTIGATING'],
  CLOSED: [], // Terminal state
};

class WorkItemState {
  constructor(status) {
    this.status = status;
  }

  canTransitionTo(nextStatus) {
    return TRANSITIONS[this.status]?.includes(nextStatus) ?? false;
  }

  getAllowedTransitions() {
    return TRANSITIONS[this.status] || [];
  }
}

export class WorkItemStateMachine {
  constructor(currentStatus = 'OPEN') {
    this.state = new WorkItemState(currentStatus);
  }

  transition(nextStatus, { rca } = {}) {
    if (!this.state.canTransitionTo(nextStatus)) {
      throw new StateTransitionError(
        `Cannot transition from ${this.state.status} to ${nextStatus}. ` +
        `Allowed: [${this.state.getAllowedTransitions().join(', ')}]`
      );
    }

    if (nextStatus === 'CLOSED') {
      this._validateRCA(rca);
    }

    this.state = new WorkItemState(nextStatus);
    return this;
  }

  _validateRCA(rca) {
    if (!rca) {
      throw new RCAValidationError('RCA object is required to close a work item');
    }
    const required = ['rootCauseCategory', 'fixApplied', 'preventionSteps', 'incidentStart', 'incidentEnd'];
    const missing = required.filter(f => !rca[f] || String(rca[f]).trim() === '');
    if (missing.length > 0) {
      throw new RCAValidationError(`RCA is incomplete. Missing fields: ${missing.join(', ')}`);
    }
    if (new Date(rca.incidentEnd) <= new Date(rca.incidentStart)) {
      throw new RCAValidationError('incidentEnd must be after incidentStart');
    }
  }

  get currentStatus() {
    return this.state.status;
  }

  get allowedTransitions() {
    return this.state.getAllowedTransitions();
  }
}

export class StateTransitionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StateTransitionError';
    this.code = 'INVALID_TRANSITION';
  }
}

export class RCAValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RCAValidationError';
    this.code = 'RCA_VALIDATION_FAILED';
  }
}

/**
 * Calculate MTTR in minutes
 */
export function calculateMTTR(startTime, endTime) {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  return Math.round((end - start) / 60000); // minutes
}
