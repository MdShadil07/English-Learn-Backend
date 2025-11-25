import { Router } from 'express';
import { authController } from '../../controllers/Auth/auth.controller.js';
import {
  authenticate,
  optionalAuth,
  refreshAuthToken,
  requireEmailVerification
} from '../../middleware/auth/auth.js';
import {
  validateRegistration,
  validateLogin,
  validateRefreshToken,
  validateProfileUpdate,
  validateChangePassword,
  validatePasswordResetRequest,
  validatePasswordReset,
} from '../../middleware/validation/validation.js';
import {
  authRateLimit,
  passwordResetRateLimit
} from '../../middleware/security/rateLimit.js';

const router = Router();

// Public routes (no authentication required)
router.post('/register', authRateLimit, validateRegistration, authController.register);
router.post('/login', authRateLimit, validateLogin, authController.login);
router.post('/refresh-token', validateRefreshToken, refreshAuthToken, authController.refreshToken);

// Password reset routes
router.post('/forgot-password', passwordResetRateLimit, validatePasswordResetRequest, authController.requestPasswordReset);
router.post('/reset-password', passwordResetRateLimit, validatePasswordReset, authController.resetPassword);

// Email verification
router.get('/verify-email', authController.verifyEmail);

// Protected routes (authentication required)
router.use(authenticate); // All routes below require authentication

// Profile routes
router.get('/profile', authController.getProfile);
router.put('/profile', validateProfileUpdate, authController.updateProfile);

// Password management
router.post('/change-password', validateChangePassword, authController.changePassword);

// Authentication status and logout
router.post('/logout', authController.logout);
router.post('/logout-all', authController.logoutAll);

// Email verification required routes
router.use(requireEmailVerification); // Routes below require email verification

// Additional protected routes can be added here
// router.get('/dashboard', authController.getDashboard);
// router.get('/stats', authController.getStats);

export default router;
