import Bull from 'bull';
import logger from '../utils/logger';
import WorkItem from '../models/WorkItem';
import { AlertingStrategyFactory } from '../patterns/AlertingStrategy';

export class WorkItemProcessor {
  private workItemQueue: Bull.Queue;

  constructor(redisClient: any) {
    this.workItemQueue = new Bull('workitem-processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    });

    this.setupProcessors();
  }

  private setupProcessors(): void {
    // Process work item creation/update events
    this.workItemQueue.process('create', async (job) => {
      logger.info({ jobId: job.id }, 'Processing work item creation');
      const { workItemId } = job.data;

      const workItem = await WorkItem.findById(workItemId);
      if (workItem) {
        // Send alert based on severity
        const alertStrategy = AlertingStrategyFactory.getStrategy(workItem.initialSeverity);
        await alertStrategy.send(
          workItem.componentId,
          workItem.initialSeverity,
          `New incident: ${workItem.title} - ${workItem.signalCount} signals detected`
        );

        workItem.alerts.push({
          type: 'initial_notification',
          sentAt: new Date(),
          recipient: 'on-call-team'
        });
        await workItem.save();
      }
    });

    // Process status transitions
    this.workItemQueue.process('transition', async (job) => {
      logger.info({ jobId: job.id }, 'Processing status transition');
      const { workItemId, newStatus } = job.data;

      const workItem = await WorkItem.findById(workItemId);
      if (workItem) {
        const oldStatus = workItem.status;
        workItem.status = newStatus;

        if (newStatus === 'RESOLVED') {
          workItem.resolvedTime = new Date();
        } else if (newStatus === 'CLOSED') {
          workItem.closedTime = new Date();
          // Calculate MTTR
          if (workItem.rca && workItem.firstSignalTime) {
            workItem.mttr = workItem.rca.endTime.getTime() - workItem.firstSignalTime.getTime();
          }
        }

        await workItem.save();
        logger.info({ workItemId, oldStatus, newStatus }, 'Status transitioned');
      }
    });
  }

  async enqueueWorkItemCreation(workItemId: string): Promise<void> {
    await this.workItemQueue.add('create', { workItemId }, { delay: 0 });
  }

  async enqueueStatusTransition(workItemId: string, newStatus: string): Promise<void> {
    await this.workItemQueue.add('transition', { workItemId, newStatus }, { delay: 0 });
  }
}
