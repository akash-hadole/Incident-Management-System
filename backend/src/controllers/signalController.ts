import { Request, Response } from 'express';
import Signal from '../models/Signal';
import logger from '../utils/logger';

export const ingestSignal = async (req: Request, res: Response) => {
  try {
    const { componentId, componentType, errorType, message, stackTrace, latency, metadata } = req.body;

    if (!componentId || !componentType || !errorType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const signal = await Signal.create({
      componentId,
      componentType,
      errorType,
      message,
      stackTrace,
      latency,
      timestamp: new Date(),
      metadata: metadata || {}
    });

    res.status(202).json({ message: 'Signal accepted for processing', signalId: signal._id });
  } catch (error) {
    logger.error({ error }, 'Signal ingestion failed');
    res.status(500).json({ error: 'Failed to ingest signal' });
  }
};

export const getSignals = async (req: Request, res: Response) => {
  try {
    const { componentId, limit = 100, offset = 0 } = req.query;

    const query: any = {};
    if (componentId) query.componentId = componentId;

    const signals = await Signal.find(query)
      .sort({ timestamp: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    const total = await Signal.countDocuments(query);

    res.json({ signals, total, limit: Number(limit), offset: Number(offset) });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch signals');
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
};

export const getSignalsByWorkItem = async (req: Request, res: Response) => {
  try {
    const { workItemId } = req.params;

    const signals = await Signal.find({ workItemId }).sort({ timestamp: -1 });

    res.json({ signals, count: signals.length });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch signals for work item');
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
};
