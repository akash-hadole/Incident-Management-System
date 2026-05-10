const { describe, it } = require('node:test');
const assert = require('node:assert');
const { WorkItemStateMachine, STATES } = require('../src/workflow/workItemStateMachine');

describe('RCA Validation Logic', () => {
  it('allows OPEN → INVESTIGATING transition', () => {
    const sm = new WorkItemStateMachine(STATES.OPEN);
    sm.transition(STATES.INVESTIGATING);
    assert.strictEqual(sm.getState(), STATES.INVESTIGATING);
  });

  it('blocks OPEN → RESOLVED (invalid jump)', () => {
    const sm = new WorkItemStateMachine(STATES.OPEN);
    assert.throws(() => sm.transition(STATES.RESOLVED), /Invalid transition/);
  });

  it('rejects CLOSED without RCA', () => {
    const sm = new WorkItemStateMachine(STATES.RESOLVED);
    assert.throws(() => sm.transition(STATES.CLOSED), /RCA is required/);
  });

  it('rejects CLOSED with incomplete RCA', () => {
    const sm = new WorkItemStateMachine(STATES.RESOLVED);
    const bad = { rootCauseCategory: 'Bug', fixApplied: '', preventionSteps: '', incidentStart: '', incidentEnd: '' };
    assert.throws(() => sm.transition(STATES.CLOSED, bad), /RCA incomplete/);
  });

  it('rejects RCA where end <= start', () => {
    const sm = new WorkItemStateMachine(STATES.RESOLVED);
    const bad = { rootCauseCategory: 'Bug', fixApplied: 'Fix', preventionSteps: 'Monitor', incidentStart: '2024-01-01T10:00:00Z', incidentEnd: '2024-01-01T09:00:00Z' };
    assert.throws(() => sm.transition(STATES.CLOSED, bad), /incidentEnd must be after/);
  });

  it('allows CLOSED with complete valid RCA', () => {
    const sm = new WorkItemStateMachine(STATES.RESOLVED);
    const valid = { rootCauseCategory: 'Infrastructure Failure', fixApplied: 'Restarted DB', preventionSteps: 'Add circuit breaker', incidentStart: '2024-01-01T08:00:00Z', incidentEnd: '2024-01-01T10:30:00Z' };
    sm.transition(STATES.CLOSED, valid);
    assert.strictEqual(sm.getState(), STATES.CLOSED);
  });

  it('MTTR calculation is correct', () => {
    const mttr = WorkItemStateMachine.calculateMTTR('2024-01-01T08:00:00Z', '2024-01-01T10:30:00Z');
    assert.strictEqual(mttr.hours, 2);
    assert.strictEqual(mttr.minutes, 150);
    assert.strictEqual(mttr.display, '2h 30m');
  });

  it('CLOSED state has no valid transitions', () => {
    const sm = new WorkItemStateMachine(STATES.CLOSED);
    assert.strictEqual(sm.getValidTransitions().length, 0);
  });
});
