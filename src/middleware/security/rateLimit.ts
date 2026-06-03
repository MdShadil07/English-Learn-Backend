import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import authConfig from '../../config/auth.js';

// General API rate limiter
export const apiRateLimit = rateLimit({
  windowMs: authConfig.rateLimitWindowMs,
  max: process.env.NODE_ENV === 'development' ? 2000 : authConfig.rateLimitMax || 1000, 
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
  keyGenerator: (req: Request) => {
    // Prevent DoS on shared networks (like schools) by combining IP and Email
    const email = req.body?.email || '';
    return `${req.ip}-${email.toLowerCase()}`;
  },
  skip: (req: Request) => {
    // Skip rate limiting for successful requests and GET requests in development
    return req.method === 'GET' || (process.env.NODE_ENV === 'development' && req.method === 'POST');
  },
});

const normalizeEmail = (value: unknown) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
};

// Forgot-password rate limiter keyed by account email so one user cannot
// block another user on the same shared IP.
export const forgotPasswordRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: {
    success: false,
    message: 'Too many password reset requests for this account, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = normalizeEmail(req.body?.email);

    if (email) {
      return `forgot-password:${email}`;
    }

    return `forgot-password-ip:${req.ip}`;
  },
});

// Reset-password limiter stays separate and is keyed by IP because the token
// is already a high-entropy single-use secret.
export const resetPasswordRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many password reset submissions, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `reset-password-ip:${req.ip}`;
  },
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

// Support contact rate limiter to reduce ticket spam
export const supportRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 20 : 5,
  message: {
    success: false,
    message: 'Too many support requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    return `${req.ip}-${email.toLowerCase()}`;
  },
});
