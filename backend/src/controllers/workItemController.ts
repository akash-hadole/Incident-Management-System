import { Response } from 'express';
import WorkItem from '../models/WorkItem';
import Signal from '../models/Signal';
import { AuthRequest } from '../middleware/auth';
import { WorkItemStateFactory } from '../patterns/StatePattern';
import logger from '../utils/logger';

export const getWorkItems = async (req: AuthRequest, res: Response) => {
  try {
    const { status, severity, page = 1, limit = 20 } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (severity) query.initialSeverity = severity;

    const skip = (Number(page) - 1) * Number(limit);

    const workItems = await WorkItem.find(query)
      .sort({ firstSignalTime: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await WorkItem.countDocuments(query);

    res.json({
      workItems,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch work items');
    res.status(500).json({ error: error.message });
  }
};

export const getWorkItemDetail = async (req: AuthRequest, res: Response) => {
  try {
    const { workItemId } = req.params;

    const workItem = await WorkItem.findById(workItemId);
    if (!workItem) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    const signals = await Signal.find({ workItemId }).sort({ timestamp: -1 });

    res.json({ workItem, signals, signalCount: signals.length });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch work item detail');
    res.status(500).json({ error: error.message });
  }
};

export const updateWorkItemStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { workItemId } = req.params;
    const { newStatus } = req.body;

    const workItem = await WorkItem.findById(workItemId);
    if (!workItem) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    // Use State Pattern for transition validation
    const currentState = WorkItemStateFactory.getState(workItem.status);
    if (!currentState.getNextStates().includes(newStatus)) {
      return res.status(400).json({
        error: `Cannot transition from ${workItem.status} to ${newStatus}`,
        validTransitions: currentState.getNextStates()
      });
    }

    // Validate RCA before closing
    if (newStatus === 'CLOSED' && !workItem.rca) {
      return res.status(400).json({ error: 'RCA is mandatory before closing work item' });
    }

    workItem.status = newStatus;
    if (newStatus === 'RESOLVED') {
      workItem.resolvedTime = new Date();
    } else if (newStatus === 'CLOSED') {
      workItem.closedTime = new Date();
      if (workItem.rca) {
        workItem.mttr = workItem.rca.endTime.getTime() - workItem.firstSignalTime.getTime();
      }
    }

    await workItem.save();
    logger.info({ workItemId, newStatus }, 'Work item status updated');

    res.json({ message: 'Status updated', workItem });
  } catch (error: any) {
    logger.error({ error }, 'Failed to update work item status');
    res.status(500).json({ error: error.message });
  }
};

export const submitRCA = async (req: AuthRequest, res: Response) => {
  try {
    const { workItemId } = req.params;
    const {
      rootCauseCategory,
      rootCauseDescription,
      fixApplied,
      preventionSteps,
      startTime,
      endTime
    } = req.body;

    if (!rootCauseCategory || !fixApplied || !preventionSteps || !startTime || !endTime) {
      return res.status(400).json({ error: 'All RCA fields are required' });
    }

    const workItem = await WorkItem.findById(workItemId);
    if (!workItem) {
      return res.status(404).json({ error: 'Work item not found' });
    }

    workItem.rca = {
      rootCauseCategory,
      rootCauseDescription,
      fixApplied,
      preventionSteps,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      submittedBy: req.user!.userId as any,
      submittedAt: new Date()
    } as any;

    await workItem.save();
    logger.info({ workItemId }, 'RCA submitted');

    res.json({ message: 'RCA submitted successfully', workItem });
  } catch (error: any) {
    logger.error({ error }, 'Failed to submit RCA');
    res.status(500).json({ error: error.message });
  }
};
