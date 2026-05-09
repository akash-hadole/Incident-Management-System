/**
 * DebounceEngine — 10-second debounce window per Component ID.
 * If 100+ signals arrive for the same component within 10s, only ONE WorkItem is created.
 */

import { v4 as uuidv4 } from 'uuid';
import { getAlertStrategy } from '../workflow/AlertingStrategy.js';

const DEBOUNCE_WINDOW_MS = 10_000;
const debounceWindows = new Map(); // componentId → { workItemId, timer, count }

/**
 * @returns {{ workItemId: string, isNew: boolean }}
 */
export function debounceSignal(signal, onNewWorkItem) {
  const { componentId, componentType } = signal;

  if (debounceWindows.has(componentId)) {
    const entry = debounceWindows.get(componentId);
    entry.count++;
    return { workItemId: entry.workItemId, isNew: false };
  }

  // First signal for this component — create work item
  const workItemId = uuidv4();
  const strategy = getAlertStrategy(componentType);

  const workItem = {
    id: workItemId,
    componentId,
    componentType,
    priority: strategy.priority,
    priorityLabel: strategy.label,
    escalateTo: strategy.escalateTo,
    status: 'OPEN',
    title: `Incident: ${componentId}`,
    alertMessage: strategy.format(signal),
    signalCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rca: null,
    mttrSeconds: null,
  };

  const timer = setTimeout(() => {
    debounceWindows.delete(componentId);
  }, DEBOUNCE_WINDOW_MS);

  debounceWindows.set(componentId, { workItemId, timer, count: 1 });

  onNewWorkItem(workItem);
  return { workItemId, isNew: true };
}

export function getActiveWindows() {
  return [...debounceWindows.entries()].map(([componentId, v]) => ({
    componentId,
    workItemId: v.workItemId,
    count: v.count,
  }));
}
