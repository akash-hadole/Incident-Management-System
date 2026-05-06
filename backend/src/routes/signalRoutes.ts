import express from 'express';
import { ingestSignal, getSignals, getSignalsByWorkItem } from '../controllers/signalController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Ingestion endpoint (public, but rate-limited)
router.post('/ingest', ingestSignal);

// Query endpoints (authenticated)
router.use(authMiddleware);
router.get('/', getSignals);
router.get('/workitem/:workItemId', getSignalsByWorkItem);

export default router;
