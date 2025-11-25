import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, RefreshToken } from '../../models/index.js';
import authConfig from '../../config/auth.js';

export interface AuthRequest extends Request {
  user?: any;
  token?: string;
}

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
}

// Generate JWT tokens
export const generateTokens = (userId: string, email: string, role: string) => {
  const accessToken = jwt.sign(
    { userId, email, role, type: 'access' as const },
    authConfig.jwtSecret,
    { expiresIn: '7d' as any }
  );

  const refreshToken = jwt.sign(
    { userId, email, role, type: 'refresh' as const },
    authConfig.refreshTokenSecret,
    { expiresIn: '30d' as any }
  );

  return { accessToken, refreshToken };
};

// Verify JWT token
export const verifyToken = (token: string, secret: string): Promise<JWTPayload> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as JWTPayload);
      }
    });
  });
};

// Authentication middleware
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    console.log('🔐 Auth middleware: Authorization header:', authHeader);

    // Check Authorization header first, then query parameter (for SSE)
    let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token && req.query.token) {
      token = req.query.token as string;
      console.log('🔐 Auth middleware: Token from query parameter');
    }
    
    console.log('🔐 Auth middleware: Extracted token:', token ? 'present' : 'missing');

    if (!token) {
      console.log('❌ Auth middleware: No token provided');
      res.status(401).json({
        success: false,
        message: 'Access token is required',
      });
      return;
    }

    // Verify token
    console.log('🔐 Auth middleware: Verifying token...');
    const decoded = await verifyToken(token, authConfig.jwtSecret);
    console.log('🔐 Auth middleware: Token decoded:', decoded);

    if (decoded.type !== 'access') {
      console.log('❌ Auth middleware: Invalid token type:', decoded.type);
      res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
      return;
    }

    // Find user
    console.log('🔐 Auth middleware: Finding user with ID:', decoded.userId);
    const user = await User.findById(decoded.userId).select('-password');
    console.log('🔐 Auth middleware: User found:', user ? 'yes' : 'no');

    if (!user) {
      console.log('❌ Auth middleware: User not found in database');
      res.status(401).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // TODO: Check UserProfile.isActive when profile exists
    // For now, assume user is active if they exist in database

    console.log('✅ Auth middleware: Authentication successful for user:', user.email);
    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('❌ Auth middleware: Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

// Refresh token middleware
export const refreshAuthToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Refresh token is required',
      });
      return;
    }

    // Verify refresh token
    const decoded = await verifyToken(token, authConfig.refreshTokenSecret);

    if (decoded.type !== 'refresh') {
      res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
      return;
    }

    // Check if refresh token exists in database
    const storedToken = await RefreshToken.findValidToken(token, decoded.userId as any);
    if (!storedToken) {
      res.status(401).json({
        success: false,
        message: 'Invalid or revoked refresh token',
      });
      return;
    }

    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // TODO: Check UserProfile.isActive when profile exists
    // For now, assume user is active if they exist in database

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
    });
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // No token, continue without authentication
    }

    // Verify token
    const decoded = await verifyToken(token, authConfig.jwtSecret);

    if (decoded.type !== 'access') {
      return next(); // Invalid token type, continue without authentication
    }

    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    if (user) {
      req.user = user;
      req.token = token;
    }

    next();
  } catch (error) {
    // Invalid token, continue without authentication
    next();
  }
};

// Teacher or Admin middleware (for teacher-specific features)
export const requireTeacherOrAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Check if user has teacher or admin role
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Teacher or Admin access required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Teacher/Admin check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Email verification middleware (placeholder for future implementation)
export const requireEmailVerification = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // TODO: Check email verification status when implemented
    // For now, skip email verification check
    // if (!req.user.isEmailVerified) {
    //   res.status(403).json({
    //     success: false,
    //     message: 'Email verification required',
    //     code: 'EMAIL_NOT_VERIFIED',
    //   });
    //   return;
    // }

    next();
  } catch (error) {
    console.error('Email verification check error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
