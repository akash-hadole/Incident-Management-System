import { Response } from 'express';
import Incident from '../models/Incident';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';

export const createIncident = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, priority, category, tags } = req.body;

    const incident = new Incident({
      title,
      description,
      priority: priority || 'medium',
      category,
      createdBy: req.user?.userId,
      tags: tags || []
    });

    await incident.save();
    res.status(201).json({ message: 'Incident created', incident });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getIncidents = async (req: AuthRequest, res: Response) => {
  try {
    const { status, priority, assignedTo, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    const incidents = await Incident.find(filter)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Incident.countDocuments(filter);

    res.json({ incidents, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getIncidentById = async (req: AuthRequest, res: Response) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('comments.author', 'name email');

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    res.json(incident);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateIncident = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, priority, status, category, resolution, tags } = req.body;
    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    if (title) incident.title = title;
    if (description) incident.description = description;
    if (priority) incident.priority = priority;
    if (status) {
      incident.status = status;
      if (status === 'resolved' && !incident.resolvedAt) {
        incident.resolvedAt = new Date();
      }
    }
    if (category) incident.category = category;
    if (resolution) incident.resolution = resolution;
    if (tags) incident.tags = tags;

    await incident.save();
    res.json({ message: 'Incident updated', incident });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const assignIncident = async (req: AuthRequest, res: Response) => {
  try {
    const { assignedTo } = req.body;
    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      { assignedTo },
      { new: true }
    );

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    if (assignedTo) {
      const notification = new Notification({
        user: assignedTo,
        incident: incident._id,
        type: 'assigned',
        message: `You have been assigned to incident: ${incident.title}`
      });
      await notification.save();
    }

    res.json({ message: 'Incident assigned', incident });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const { text } = req.body;
    const incident = await Incident.findById(req.params.id);

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    incident.comments.push({
      author: new mongoose.Types.ObjectId(req.user?.userId),
      text,
      createdAt: new Date()
    });

    await incident.save();

    const notification = new Notification({
      user: incident.assignedTo,
      incident: incident._id,
      type: 'comment',
      message: `New comment on incident: ${incident.title}`
    });
    await notification.save();

    res.json({ message: 'Comment added', incident });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteIncident = async (req: AuthRequest, res: Response) => {
  try {
    const incident = await Incident.findByIdAndDelete(req.params.id);

    if (!incident) {
      return res.status(404).json({ message: 'Incident not found' });
    }

    res.json({ message: 'Incident deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
