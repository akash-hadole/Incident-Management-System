import express, { Express } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Redis from 'redis';
import http from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/authRoutes';
import incidentRoutes from './routes/incidentRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import signalRoutes from './routes/signalRoutes';
import workItemRoutes from './routes/workItemRoutes';

import { signalIngestionLimiter, apiLimiter, loginLimiter } from './middleware/rateLimiter';
import logger from './utils/logger';
import { SignalIngestionService } from './services/SignalIngestionService';
import { WorkItemProcessor } from './services/WorkItemProcessor';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Redis client
const redisClient = Redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
});

redisClient.on('error', (err) => logger.error({ error: err }, 'Redis error'));
redisClient.on('connect', () => logger.info('Redis connected'));

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ims');
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error({ error }, 'MongoDB connection failed');
    process.exit(1);
  }
};

connectDB();

// Initialize services
const signalIngestionService = new SignalIngestionService(redisClient as any);
const workItemProcessor = new WorkItemProcessor(redisClient);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Routes
app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api/signals', signalIngestionLimiter, signalRoutes);
app.use('/api/workitems', apiLimiter, workItemRoutes);
app.use('/api/incidents', apiLimiter, incidentRoutes);
app.use('/api/analytics', apiLimiter, analyticsRoutes);

// WebSocket for real-time updates
io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');

  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });

  socket.on('subscribe:workitems', () => {
    socket.join('workitems-feed');
    logger.info({ socketId: socket.id }, 'Subscribed to workitems feed');
  });
});

// Make io globally accessible
(global as any).io = io;

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'IMS Backend server is running');
  logger.info('Endpoints:');
  logger.info('  - Signal Ingestion: POST /api/signals/ingest');
  logger.info('  - Work Items: GET /api/workitems');
  logger.info('  - Health: GET /health');
});
