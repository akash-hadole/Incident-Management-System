import pg from 'pg';
import { MongoClient } from 'mongodb';
import { logger } from '../observability/logger.js';

const { Pool } = pg;

const RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1000;

async function withRetry(fn, attempts = RETRY_ATTEMPTS) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      logger.warn(`DB operation failed, retry ${i + 1}/${attempts}: ${err.message}`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (i + 1)));
    }
  }
}

export class DatabaseManager {
  constructor() {
    this.pgPool = null;
    this.mongoClient = null;
    this.mongodb = null;
  }

  async connect() {
    // PostgreSQL - Source of Truth
    this.pgPool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_DB || 'ims',
      user: process.env.POSTGRES_USER || 'ims_user',
      password: process.env.POSTGRES_PASSWORD || 'ims_pass',
      max: 20,
      idleTimeoutMillis: 30000,
    });

    await withRetry(() => this.pgPool.query('SELECT 1'));
    await this._initPostgresSchema();
    logger.info('PostgreSQL connected');

    // MongoDB - Data Lake for raw signals
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
    this.mongoClient = new MongoClient(mongoUrl, { maxPoolSize: 20 });
    await withRetry(() => this.mongoClient.connect());
    this.mongodb = this.mongoClient.db('ims_datalake');
    await this._initMongoIndexes();
    logger.info('MongoDB connected');
  }

  async _initPostgresSchema() {
    await this.pgPool.query(`
      CREATE TABLE IF NOT EXISTS work_items (
        id UUID PRIMARY KEY,
        component_id VARCHAR(255) NOT NULL,
        component_type VARCHAR(100) NOT NULL,
        title TEXT NOT NULL,
        priority VARCHAR(10) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
        alert_channels JSONB DEFAULT '[]',
        signal_count INTEGER DEFAULT 0,
        start_time TIMESTAMPTZ,
        end_time TIMESTAMPTZ,
        mttr_minutes INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS rca_records (
        id UUID PRIMARY KEY,
        work_item_id UUID REFERENCES work_items(id),
        root_cause_category VARCHAR(255) NOT NULL,
        fix_applied TEXT NOT NULL,
        prevention_steps TEXT NOT NULL,
        incident_start TIMESTAMPTZ NOT NULL,
        incident_end TIMESTAMPTZ NOT NULL,
        mttr_minutes INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
      CREATE INDEX IF NOT EXISTS idx_work_items_priority ON work_items(priority);
      CREATE INDEX IF NOT EXISTS idx_work_items_component ON work_items(component_id);
      CREATE INDEX IF NOT EXISTS idx_rca_work_item ON rca_records(work_item_id);
    `);
  }

  async _initMongoIndexes() {
    const col = this.mongodb.collection('signals');
    await col.createIndex({ componentId: 1, storedAt: -1 });
    await col.createIndex({ workItemId: 1 });
    await col.createIndex({ storedAt: -1 });
    await col.createIndex({ componentType: 1, storedAt: -1 });
  }

  // ── Work Items ──────────────────────────────────────────────────────────────

  async createWorkItem(item) {
    return withRetry(() =>
      this.pgPool.query(
        `INSERT INTO work_items 
          (id, component_id, component_type, title, priority, status, alert_channels, signal_count, start_time, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())`,
        [item.id, item.componentId, item.componentType, item.title, item.priority,
         item.status, JSON.stringify(item.alertChannels), item.signalCount, item.startTime]
      )
    );
  }

  async updateWorkItemStatus(id, status, extra = {}) {
    const fields = ['status = $2', 'updated_at = NOW()'];
    const vals = [id, status];
    let i = 3;

    if (extra.endTime) { fields.push(`end_time = $${i++}`); vals.push(extra.endTime); }
    if (extra.mttrMinutes != null) { fields.push(`mttr_minutes = $${i++}`); vals.push(extra.mttrMinutes); }

    return withRetry(() =>
      this.pgPool.query(
        `UPDATE work_items SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
        vals
      )
    );
  }

  async incrementSignalCount(workItemId, count) {
    return withRetry(() =>
      this.pgPool.query(
        `UPDATE work_items SET signal_count = signal_count + $2, updated_at = NOW() WHERE id = $1`,
        [workItemId, count]
      )
    );
  }

  async getWorkItems({ status, priority, limit = 50 } = {}) {
    let query = `SELECT w.*, r.id as rca_id FROM work_items w 
                 LEFT JOIN rca_records r ON r.work_item_id = w.id`;
    const conditions = [];
    const vals = [];
    if (status) { conditions.push(`w.status = $${vals.length + 1}`); vals.push(status); }
    if (priority) { conditions.push(`w.priority = $${vals.length + 1}`); vals.push(priority); }
    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY CASE w.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, w.created_at DESC LIMIT $${vals.length + 1}`;
    vals.push(limit);
    const result = await this.pgPool.query(query, vals);
    return result.rows;
  }

  async getWorkItemById(id) {
    const result = await this.pgPool.query(
      `SELECT w.*, r.root_cause_category, r.fix_applied, r.prevention_steps, r.incident_start, r.incident_end
       FROM work_items w LEFT JOIN rca_records r ON r.work_item_id = w.id WHERE w.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  // ── RCA ────────────────────────────────────────────────────────────────────

  async createRCA(rca) {
    const client = await this.pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO rca_records (id, work_item_id, root_cause_category, fix_applied, prevention_steps, incident_start, incident_end, mttr_minutes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [rca.id, rca.workItemId, rca.rootCauseCategory, rca.fixApplied,
         rca.preventionSteps, rca.incidentStart, rca.incidentEnd, rca.mttrMinutes]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getRCAByWorkItem(workItemId) {
    const result = await this.pgPool.query(
      `SELECT * FROM rca_records WHERE work_item_id = $1`,
      [workItemId]
    );
    return result.rows[0] || null;
  }

  // ── Signals (MongoDB) ──────────────────────────────────────────────────────

  async insertSignals(signals) {
    if (!signals.length) return;
    return withRetry(() =>
      this.mongodb.collection('signals').insertMany(signals, { ordered: false })
    );
  }

  async getSignalsByWorkItem(workItemId, limit = 100) {
    return this.mongodb.collection('signals')
      .find({ workItemId })
      .sort({ storedAt: -1 })
      .limit(limit)
      .toArray();
  }

  async getSignalStats() {
    return this.mongodb.collection('signals').aggregate([
      { $group: { _id: '$componentType', count: { $sum: 1 }, latest: { $max: '$storedAt' } } },
      { $sort: { count: -1 } }
    ]).toArray();
  }

  async disconnect() {
    await this.pgPool?.end();
    await this.mongoClient?.close();
  }
}
