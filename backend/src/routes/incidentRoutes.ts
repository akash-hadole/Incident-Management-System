import express from 'express';
import {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncident,
  assignIncident,
  addComment,
  deleteIncident
} from '../controllers/incidentController';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

router.post('/', createIncident);
router.get('/', getIncidents);
router.get('/:id', getIncidentById);
router.put('/:id', updateIncident);
router.put('/:id/assign', roleMiddleware(['admin', 'manager']), assignIncident);
router.post('/:id/comments', addComment);
router.delete('/:id', roleMiddleware(['admin', 'manager']), deleteIncident);

export default router;
