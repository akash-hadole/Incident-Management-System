/**
 * Work Item State Machine (State Pattern)
 * OPEN → INVESTIGATING → RESOLVED → CLOSED
 */

const STATES = {
  OPEN:          'OPEN',
  INVESTIGATING: 'INVESTIGATING',
  RESOLVED:      'RESOLVED',
  CLOSED:        'CLOSED',
};

const VALID_TRANSITIONS = {
  [STATES.OPEN]:          [STATES.INVESTIGATING],
  [STATES.INVESTIGATING]: [STATES.RESOLVED],
  [STATES.RESOLVED]:      [STATES.CLOSED],
  [STATES.CLOSED]:        [],
};

class WorkItemStateMachine {
  constructor(currentState = STATES.OPEN) {
    if (!STATES[currentState]) throw new Error(`Invalid state: ${currentState}`);
    this.state = currentState;
  }

  canTransition(nextState) {
    return VALID_TRANSITIONS[this.state]?.includes(nextState) ?? false;
  }

  transition(nextState, rca = null) {
    if (!this.canTransition(nextState)) {
      throw new Error(`Invalid transition: ${this.state} → ${nextState}`);
    }
    if (nextState === STATES.CLOSED) {
      this._validateRCA(rca);
    }
    this.state = nextState;
    return this.state;
  }

  _validateRCA(rca) {
    if (!rca) throw new Error('RCA is required to close a Work Item');
    const required = ['rootCauseCategory', 'fixApplied', 'preventionSteps', 'incidentStart', 'incidentEnd'];
    const missing = required.filter(f => !rca[f] || String(rca[f]).trim() === '');
    if (missing.length > 0) {
      throw new Error(`RCA incomplete. Missing fields: ${missing.join(', ')}`);
    }
    if (new Date(rca.incidentEnd) <= new Date(rca.incidentStart)) {
      throw new Error('RCA incidentEnd must be after incidentStart');
    }
  }

  getState() { return this.state; }

  getValidTransitions() { return VALID_TRANSITIONS[this.state] || []; }

  static calculateMTTR(startTime, endTime) {
    const start = new Date(startTime).getTime();
    const end   = new Date(endTime).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    const diffMs = end - start;
    const minutes = Math.floor(diffMs / 60000);
    const hours   = Math.floor(minutes / 60);
    return {
      ms: diffMs,
      minutes,
      hours,
      display: hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`,
    };
  }
}

module.exports = { WorkItemStateMachine, STATES };
