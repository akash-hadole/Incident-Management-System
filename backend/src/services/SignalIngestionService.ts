import Redis from 'redis';
import mongoose from 'mongoose';
import Signal from '../models/Signal';
import WorkItem from '../models/WorkItem';
import logger from '../utils/logger';

interface SignalDebounceEntry {
  componentId: string;
  signals: any[];
  timer: NodeJS.Timeout;
  firstSignalTime: Date;
}

export class SignalIngestionService {
  private redisClient: Redis.RedisClient;
  private debounceMap: Map<string, SignalDebounceEntry> = new Map();
  private readonly DEBOUNCE_WINDOW_MS = 10000; // 10 seconds
  private readonly DEBOUNCE_THRESHOLD = 100; // 100 signals
  private signalsProcessed = 0;
  private lastMetricsTime = Date.now();

  constructor(redisClient: Redis.RedisClient) {
    this.redisClient = redisClient;
    this.startMetricsReporting();
  }

  async ingestSignal(signal: any): Promise<void> {
    try {
      this.signalsProcessed++;

      // Store raw signal in MongoDB (audit log)
      const savedSignal = await Signal.create({
        componentId: signal.componentId,
        componentType: signal.componentType,
        errorType: signal.errorType,
        message: signal.message,
        stackTrace: signal.stackTrace,
        latency: signal.latency,
        timestamp: signal.timestamp || new Date(),
        severity: this.calculateSeverity(signal),
        metadata: signal.metadata || {}
      });

      // Debounce logic
      await this.debounceSignal(signal, savedSignal._id);

      // Cache in Redis for hot path
      await this.cacheSignalData(signal);
    } catch (error) {
      logger.error({ error, signal }, 'Failed to ingest signal');
      throw error;
    }
  }

  private async debounceSignal(signal: any, signalId: mongoose.Types.ObjectId): Promise<void> {
    const key = `signal:${signal.componentId}`;

    if (!this.debounceMap.has(key)) {
      // First signal for this component
      const entry: SignalDebounceEntry = {
        componentId: signal.componentId,
        signals: [{ signalId, data: signal }],
        firstSignalTime: new Date(),
        timer: setTimeout(async () => {
          await this.flushDebounceWindow(key);
        }, this.DEBOUNCE_WINDOW_MS)
      };

      this.debounceMap.set(key, entry);
      logger.info({ componentId: signal.componentId }, 'Debounce window opened');
    } else {
      // Add to existing window
      const entry = this.debounceMap.get(key)!;
      entry.signals.push({ signalId, data: signal });

      // If threshold reached, flush immediately
      if (entry.signals.length >= this.DEBOUNCE_THRESHOLD) {
        clearTimeout(entry.timer);
        await this.flushDebounceWindow(key);
      }
    }
  }

  private async flushDebounceWindow(key: string): Promise<void> {
    const entry = this.debounceMap.get(key);
    if (!entry) return;

    logger.info(
      { componentId: entry.componentId, signalCount: entry.signals.length },
      'Flushing debounce window'
    );

    try {
      // Create or update work item
      const workItem = await this.createOrUpdateWorkItem(entry);

      // Link all signals to work item
      const signalIds = entry.signals.map((s) => s.signalId);
      await Signal.updateMany({ _id: { $in: signalIds } }, { workItemId: workItem._id });

      logger.info(
        { workItemId: workItem._id, linkedSignals: entry.signals.length },
        'Work item created and signals linked'
      );
    } finally {
      this.debounceMap.delete(key);
    }
  }

  private async createOrUpdateWorkItem(entry: SignalDebounceEntry): Promise<any> {
    const firstSignal = entry.signals[0].data;

    // Check if work item already exists for this component
    let workItem = await WorkItem.findOne({
      componentId: entry.componentId,
      status: { $in: ['OPEN', 'INVESTIGATING'] }
    });

    if (workItem) {
      workItem.signalCount = entry.signals.length;
      workItem.lastSignalTime = new Date();
      await workItem.save();
    } else {
      workItem = new WorkItem({
        title: `${entry.componentId} - ${firstSignal.errorType}`,
        componentId: entry.componentId,
        componentType: firstSignal.componentType,
        initialSeverity: this.calculateSeverity(firstSignal),
        status: 'OPEN',
        signalCount: entry.signals.length,
        firstSignalTime: entry.firstSignalTime,
        lastSignalTime: new Date()
      });
      await workItem.save();
    }

    return workItem;
  }

  private calculateSeverity(signal: any): 'P0' | 'P1' | 'P2' | 'P3' {
    if (signal.componentType === 'DATABASE' || signal.componentType === 'API') {
      return 'P0';
    }
    if (signal.componentType === 'CACHE' || signal.componentType === 'MCP_HOST') {
      return 'P1';
    }
    if (signal.componentType === 'QUEUE') {
      return 'P2';
    }
    return 'P3';
  }

  private async cacheSignalData(signal: any): Promise<void> {
    const cacheKey = `signal:cache:${signal.componentId}`;
    const cacheData = {
      componentId: signal.componentId,
      lastSignalTime: new Date().toISOString(),
      errorCount: await this.getSignalCount(signal.componentId)
    };
    await this.redisClient.setex(cacheKey, 300, JSON.stringify(cacheData)); // 5 min TTL
  }

  private async getSignalCount(componentId: string): Promise<number> {
    return await Signal.countDocuments({
      componentId,
      timestamp: { $gte: new Date(Date.now() - 3600000) } // Last hour
    });
  }

  private startMetricsReporting(): void {
    setInterval(() => {
      const now = Date.now();
      const elapsed = now - this.lastMetricsTime;
      const throughput = (this.signalsProcessed / elapsed) * 1000;

      logger.info({ throughput: throughput.toFixed(2), totalProcessed: this.signalsProcessed }, 'Throughput metrics');

      this.signalsProcessed = 0;
      this.lastMetricsTime = now;
    }, 5000);
  }
}
