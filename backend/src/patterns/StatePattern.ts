import { IWorkItem } from '../models/WorkItem';
import logger from '../utils/logger';

export interface WorkItemState {
  transition(workItem: IWorkItem): Promise<void>;
  getName(): string;
}

export class OpenState implements WorkItemState {
  async transition(workItem: IWorkItem): Promise<void> {
    logger.info(`Work Item ${workItem._id} transitioning from OPEN to INVESTIGATING`);
    workItem.status = 'INVESTIGATING';
  }

  getName(): string {
    return 'OPEN';
  }
}

export class InvestigatingState implements WorkItemState {
  async transition(workItem: IWorkItem): Promise<void> {
    logger.info(`Work Item ${workItem._id} transitioning from INVESTIGATING to RESOLVED`);
    workItem.status = 'RESOLVED';
    workItem.resolvedTime = new Date();
  }

  getName(): string {
    return 'INVESTIGATING';
  }
}

export class ResolvedState implements WorkItemState {
  async transition(workItem: IWorkItem): Promise<void> {
    // Check if RCA is present
    if (!workItem.rca) {
      throw new Error('Cannot close work item without RCA. RCA is mandatory.');
    }

    logger.info(`Work Item ${workItem._id} transitioning from RESOLVED to CLOSED`);
    workItem.status = 'CLOSED';
    workItem.closedTime = new Date();

    // Calculate MTTR
    if (workItem.firstSignalTime && workItem.rca.endTime) {
      workItem.mttr = workItem.rca.endTime.getTime() - workItem.firstSignalTime.getTime();
      logger.info(`MTTR calculated: ${workItem.mttr}ms (${(workItem.mttr / 1000 / 60).toFixed(2)} minutes)`);
    }
  }

  getName(): string {
    return 'RESOLVED';
  }
}

export class ClosedState implements WorkItemState {
  async transition(workItem: IWorkItem): Promise<void> {
    logger.info(`Work Item ${workItem._id} is already CLOSED`);
  }

  getName(): string {
    return 'CLOSED';
  }
}

export class WorkItemStateFactory {
  static getState(status: string): WorkItemState {
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
        return new OpenState();
    }
  }
}
