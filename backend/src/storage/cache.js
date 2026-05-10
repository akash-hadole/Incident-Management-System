import { createClient } from 'redis';
import { logger } from '../observability/logger.js';

const DASHBOARD_KEY = 'ims:dashboard';
const WORK_ITEM_PREFIX = 'ims:wi:';
const ACTIVE_COUNT_KEY = 'ims:active_count';
const TTL_SECONDS = 300; // 5 minutes

export class CacheManager {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  async connect() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: { reconnectStrategy: retries => Math.min(retries * 100, 3000) }
    });

    this.client.on('error', err => logger.warn('Redis error:', err.message));
    this.client.on('connect', () => { this.connected = true; });
    this.client.on('disconnect', () => { this.connected = false; });

    await this.client.connect();
    logger.info('Redis connected');
  }

  async setWorkItem(workItem) {
    if (!this.connected) return;
    try {
      await this.client.setEx(
        `${WORK_ITEM_PREFIX}${workItem.id}`,
        TTL_SECONDS,
        JSON.stringify(workItem)
      );
    } catch (err) {
      logger.warn('Cache setWorkItem failed:', err.message);
    }
  }

  async getWorkItem(id) {
    if (!this.connected) return null;
    try {
      const data = await this.client.get(`${WORK_ITEM_PREFIX}${id}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async updateWorkItemStatus(id, status) {
    if (!this.connected) return;
    try {
      const data = await this.client.get(`${WORK_ITEM_PREFIX}${id}`);
      if (data) {
        const item = JSON.parse(data);
        item.status = status;
        item.updatedAt = new Date().toISOString();
        await this.client.setEx(`${WORK_ITEM_PREFIX}${id}`, TTL_SECONDS, JSON.stringify(item));
      }
    } catch (err) {
      logger.warn('Cache update failed:', err.message);
    }
  }

  async incrementSignalCount(workItemId, count) {
    if (!this.connected) return;
    try {
      const data = await this.client.get(`${WORK_ITEM_PREFIX}${workItemId}`);
      if (data) {
        const item = JSON.parse(data);
        item.signalCount = (item.signalCount || 0) + count;
        await this.client.setEx(`${WORK_ITEM_PREFIX}${workItemId}`, TTL_SECONDS, JSON.stringify(item));
      }
    } catch {}
  }

  async incrementActiveCount() {
    if (!this.connected) return;
    try {
      await this.client.incr(ACTIVE_COUNT_KEY);
    } catch {}
  }

  async decrementActiveCount() {
    if (!this.connected) return;
    try {
      await this.client.decr(ACTIVE_COUNT_KEY);
    } catch {}
  }

  async getActiveCount() {
    if (!this.connected) return 0;
    try {
      return parseInt(await this.client.get(ACTIVE_COUNT_KEY)) || 0;
    } catch { return 0; }
  }

  async setDashboardState(state) {
    if (!this.connected) return;
    try {
      await this.client.setEx(DASHBOARD_KEY, 30, JSON.stringify(state));
    } catch {}
  }

  async getDashboardState() {
    if (!this.connected) return null;
    try {
      const data = await this.client.get(DASHBOARD_KEY);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  }

  get isConnected() {
    return this.connected;
  }

  async disconnect() {
    await this.client?.quit();
  }
}
