import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import authConfig from '../../config/auth.js';

// General API rate limiter
export const apiRateLimit = rateLimit({
  windowMs: authConfig.rateLimitWindowMs,
  max: process.env.NODE_ENV === 'development' ? 500 : authConfig.rateLimitMax, // 500 requests in dev, use config in production
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for authentication routes
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 50 : 5, // 50 attempts in dev, 5 in production
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    // Skip rate limiting for successful requests and GET requests in development
    return req.method === 'GET' || (process.env.NODE_ENV === 'development' && req.method === 'POST');
  },
});

// Password reset rate limiter (very strict)
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload rate limiter
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: {
    success: false,
    message: 'Upload limit exceeded, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
