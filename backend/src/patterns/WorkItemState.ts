// State Pattern for Work Item Lifecycle
import { IWorkItem, WorkItemStatus } from '../models/WorkItem';

export interface WorkItemState {
  canTransitionTo(targetStatus: WorkItemStatus): boolean;
  getNextStates(): WorkItemStatus[];
}

export class OpenState implements WorkItemState {
  canTransitionTo(targetStatus: WorkItemStatus): boolean {
    return ['INVESTIGATING', 'CLOSED'].includes(targetStatus);
  }

  getNextStates(): WorkItemStatus[] {
    return ['INVESTIGATING', 'CLOSED'];
  }
}

export class InvestigatingState implements WorkItemState {
  canTransitionTo(targetStatus: WorkItemStatus): boolean {
    return ['RESOLVED', 'OPEN'].includes(targetStatus);
  }

  getNextStates(): WorkItemStatus[] {
    return ['RESOLVED', 'OPEN'];
  }
}

export class ResolvedState implements WorkItemState {
  canTransitionTo(targetStatus: WorkItemStatus): boolean {
    return ['CLOSED', 'INVESTIGATING'].includes(targetStatus);
  }

  getNextStates(): WorkItemStatus[] {
    return ['CLOSED', 'INVESTIGATING'];
  }
}

export class ClosedState implements WorkItemState {
  canTransitionTo(targetStatus: WorkItemStatus): boolean {
    return false; // Cannot transition out of CLOSED (terminal state)
  }

  getNextStates(): WorkItemStatus[] {
    return [];
  }
}

export class WorkItemStateFactory {
  static getState(status: WorkItemStatus): WorkItemState {
    switch (status) {
      case 'OPEN':
        return new OpenState();
      case 'INVESTIGATING':
        return new InvestigatingState();
      case 'RESOLVED':
        return new ResolvedState();
      case 'CLOSED':
        return new ClosedState();
      default:
        throw new Error(`Unknown state: ${status}`);
    }
  }
}
