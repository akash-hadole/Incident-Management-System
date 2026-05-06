import rateLimit from 'express-rate-limit';
import logger from '../utils/logger';

// Strict rate limiter for signal ingestion
export const signalIngestionLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 1000, // 1000 requests per second = 10,000 signals/sec with burst handling
  message: 'Too many signal ingestion requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (req.rateLimit.current > 900) {
      logger.warn(
        { current: req.rateLimit.current, limit: req.rateLimit.limit },
        'Approaching rate limit'
      );
    }
    return false;
  }
});

// Standard rate limiter for API endpoints
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Login rate limiter (stricter)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});
