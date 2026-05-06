import express from 'express';
import {
  getWorkItems,
  getWorkItemDetail,
  updateWorkItemStatus,
  submitRCA
} from '../controllers/workItemController';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getWorkItems);
router.get('/:workItemId', getWorkItemDetail);
router.put('/:workItemId/status', updateWorkItemStatus);
router.post('/:workItemId/rca', submitRCA);

export default router;
