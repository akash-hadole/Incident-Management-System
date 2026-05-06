import express from 'express';
import { getAnalytics } from '../controllers/analyticsController';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(['admin', 'manager']));

router.get('/', getAnalytics);

export default router;
