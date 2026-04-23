import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import { Request, Response, NextFunction } from 'express';

// CORS configuration
export const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:8081',
      'http://127.0.0.1:5173',
      process.env.FRONTEND_URL,
      process.env.CLIENT_URL
    ].filter(Boolean);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'X-API-Key',
    'X-Forwarded-For',
    'X-Real-IP',
    'X-Client-IP'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

// Enhanced security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:", "data:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// Request logging and monitoring middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';

  // Log request
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${ip} - UA: ${userAgent}`);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - ${status} - ${duration}ms`);
  });

  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize route parameters
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Helper function to recursively sanitize object properties
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return obj.trim().replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

// API key validation middleware (if using API keys)
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  if (process.env.NODE_ENV === 'production' && !apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key required'
    });
  }

  if (apiKey && apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key'
    });
  }

  return next();
};

// Request timeout middleware
export const requestTimeout = (req: Request, res: Response, next: NextFunction) => {
  const timeout = parseInt(process.env.REQUEST_TIMEOUT || '30000'); // 30 seconds default

  const timer = setTimeout(() => {
    res.status(408).json({
      success: false,
      message: 'Request timeout'
    });
  }, timeout);

  res.on('finish', () => {
    clearTimeout(timer);
  });

  next();
};

// Prevent HTTP Parameter Pollution
export const hppMiddleware = hpp({
  whitelist: [
    'sortBy',
    'sortOrder',
    'fields',
    'populate',
    'limit',
    'skip',
    'page'
  ]
});

// MongoDB query sanitization
export const mongoSanitizeMiddleware = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }: any) => {
    console.warn(`MongoDB injection attempt detected: ${key}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    });
  }
});

// XSS protection
export const xssProtection = xss();

// Global error handler for security-related errors
export const securityErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  // Log security incidents
  if (error.message.includes('CORS') || error.message.includes('XSS') || error.message.includes('injection')) {
    console.error('Security incident:', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  }

  next(error);
};

// IP whitelist middleware (for admin routes)
export const ipWhitelist = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

    if (process.env.NODE_ENV === 'development') {
      return next(); // Allow all in development
    }

    if (allowedIPs.length === 0) {
      return next(); // No restrictions if no whitelist provided
    }

    if (clientIP && allowedIPs.includes(clientIP)) {
      return next();
    }

    res.status(403).json({
      success: false,
      message: 'Access denied: IP not whitelisted'
    });
  };
};

// Rate limiting for sensitive operations
export const sensitiveRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 20 : 5, // 20 attempts in dev, 5 in production
  message: {
    success: false,
    message: 'Too many sensitive operations, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => {
    return req.method === 'GET' || process.env.NODE_ENV === 'development';
  },
  keyGenerator: (req: Request) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
});

export default {
  corsOptions,
  securityHeaders,
  requestLogger,
  sanitizeInput,
  validateApiKey,
  requestTimeout,
  hppMiddleware,
  mongoSanitizeMiddleware,
  xssProtection,
  securityErrorHandler,
  ipWhitelist,
  sensitiveRateLimit
};
