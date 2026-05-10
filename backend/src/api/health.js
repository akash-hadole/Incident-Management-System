import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  const { db, cache, queue, metrics } = req.app.locals;

  let pgStatus = 'unknown', mongoStatus = 'unknown';
  try { await db.pgPool.query('SELECT 1'); pgStatus = 'healthy'; } catch { pgStatus = 'unhealthy'; }
  try { await db.mongodb.command({ ping: 1 }); mongoStatus = 'healthy'; } catch { mongoStatus = 'unhealthy'; }

  const overall = pgStatus === 'healthy' && mongoStatus === 'healthy' ? 'healthy' : 'degraded';

  res.status(overall === 'healthy' ? 200 : 503).json({
    status: overall,
    timestamp: new Date().toISOString(),
    components: {
      postgres: pgStatus,
      mongodb: mongoStatus,
      redis: cache.isConnected ? 'healthy' : 'unhealthy',
    },
    queue: queue.stats,
    metrics: metrics.getSnapshot(),
  });
});
