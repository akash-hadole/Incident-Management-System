/**
 * Unit tests — RCA validation & state transitions
 */

import { validateTransition, applyTransition } from '../src/workflow/WorkItemState.js';

const baseWorkItem = {
  id: 'wi-001',
  componentId: 'RDBMS_01',
  status: 'OPEN',
  priority: 'P0',
  signalCount: 5,
  createdAt: new Date().toISOString(),
};

describe('Work Item State Transitions', () => {
  test('OPEN → INVESTIGATING is allowed', () => {
    const updated = applyTransition(baseWorkItem, 'INVESTIGATING');
    expect(updated.status).toBe('INVESTIGATING');
    expect(updated.investigatingAt).toBeDefined();
  });

  test('OPEN → RESOLVED is not allowed', () => {
    expect(() => applyTransition(baseWorkItem, 'RESOLVED')).toThrow();
  });

  test('OPEN → CLOSED is not allowed', () => {
    expect(() => applyTransition(baseWorkItem, 'CLOSED')).toThrow();
  });

  test('RESOLVED → CLOSED without RCA throws', () => {
    const resolvedItem = { ...baseWorkItem, status: 'RESOLVED' };
    expect(() => applyTransition(resolvedItem, 'CLOSED')).toThrow('RCA is required');
  });

  test('RESOLVED → CLOSED with incomplete RCA throws', () => {
    const resolvedItem = {
      ...baseWorkItem,
      status: 'RESOLVED',
      rca: { rootCauseCategory: 'DB_FAILURE', fixApplied: 'short', preventionSteps: '', startTime: null, endTime: null },
    };
    expect(() => applyTransition(resolvedItem, 'CLOSED')).toThrow();
  });

  test('RESOLVED → CLOSED with valid RCA succeeds and computes MTTR', () => {
    const start = new Date(Date.now() - 3600_000).toISOString(); // 1hr ago
    const end = new Date().toISOString();
    const resolvedItem = {
      ...baseWorkItem,
      status: 'RESOLVED',
      rca: {
        rootCauseCategory: 'DB_FAILURE',
        fixApplied: 'Restarted the primary replica and promoted standby.',
        preventionSteps: 'Add automated failover and increase health-check frequency.',
        startTime: start,
        endTime: end,
      },
    };
    const closed = applyTransition(resolvedItem, 'CLOSED');
    expect(closed.status).toBe('CLOSED');
    expect(closed.mttrSeconds).toBeGreaterThan(0);
    expect(closed.closedAt).toBeDefined();
  });
});

describe('RCA Validation', () => {
  test('missing rootCauseCategory fails', () => {
    const item = {
      ...baseWorkItem,
      status: 'RESOLVED',
      rca: { fixApplied: 'fixed it completely', preventionSteps: 'monitoring added', startTime: new Date().toISOString(), endTime: new Date().toISOString() },
    };
    expect(() => validateTransition(item, 'CLOSED')).toThrow('root cause category');
  });

  test('empty prevention steps fails', () => {
    const item = {
      ...baseWorkItem,
      status: 'RESOLVED',
      rca: { rootCauseCategory: 'NETWORK', fixApplied: 'rerouted traffic', preventionSteps: '', startTime: new Date().toISOString(), endTime: new Date().toISOString() },
    };
    expect(() => validateTransition(item, 'CLOSED')).toThrow('prevention steps');
  });
});
