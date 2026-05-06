import { Response } from 'express';
import Incident from '../models/Incident';
import { AuthRequest } from '../middleware/auth';

export const getAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const totalIncidents = await Incident.countDocuments();
    const openIncidents = await Incident.countDocuments({ status: 'open' });
    const inProgressIncidents = await Incident.countDocuments({ status: 'in-progress' });
    const resolvedIncidents = await Incident.countDocuments({ status: 'resolved' });

    const criticalIncidents = await Incident.countDocuments({ priority: 'critical' });
    const highIncidents = await Incident.countDocuments({ priority: 'high' });

    const incidentsByCategory = await Incident.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const incidentsByPriority = await Incident.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    const avgResolutionTime = await Incident.aggregate([
      {
        $match: { status: 'resolved', resolvedAt: { $exists: true } }
      },
      {
        $group: {
          _id: null,
          avgTime: {
            $avg: {
              $subtract: ['$resolvedAt', '$createdAt']
            }
          }
        }
      }
    ]);

    res.json({
      summary: {
        totalIncidents,
        openIncidents,
        inProgressIncidents,
        resolvedIncidents,
        criticalIncidents,
        highIncidents
      },
      byCategory: incidentsByCategory,
      byPriority: incidentsByPriority,
      averageResolutionTime: avgResolutionTime[0]?.avgTime || 0
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
