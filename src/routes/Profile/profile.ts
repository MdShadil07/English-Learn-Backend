import { Router } from 'express';
// Import authentication middleware
import { authenticate, optionalAuth } from '../../middleware/auth/auth.js';
import { profileController } from '../../controllers/Profile/profile.controller.js';
import { profileUploadService } from '../../services/Profile/profileUpload.js';
import { avatarUploadService } from '../../services/Profile/avatarUploadService.js';
import { avatarUpload, documentUpload } from '../../middleware/upload/upload.js';
import {
  validateProfileUpdate,
  validateChangePassword
} from '../../middleware/validation/validation.js';
import { User, UserProfile } from '../../models/index.js';

import { Request } from 'express';

interface AuthRequest extends Request {
  user?: {
    _id: string;
    email: string;
    role: string;
  };
  file?: Express.Multer.File;
}

const router = Router();

// All profile routes require authentication (except GET which uses optional auth)
router.use(authenticate);

// GET route uses optional authentication to prevent redirect loops
router.get('/', optionalAuth, profileController.getProfile);

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get user profile
 *     description: Retrieve the authenticated user's comprehensive profile information including personal details, preferences, and settings
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     profile:
 *                       $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/profile:
 *   put:
 *     summary: Update user profile
 *     description: Update the authenticated user's profile information. Supports partial updates of all profile fields including nested objects
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 description: User's first name
 *               lastName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 description: User's last name
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *                 pattern: '^[a-zA-Z0-9_]+$'
 *                 description: Username (alphanumeric and underscores only)
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *                 description: User biography
 *               personalInfo:
 *                 $ref: '#/components/schemas/PersonalInfo'
 *               role:
 *                 type: string
 *                 enum: [student, teacher, professional, admin, content-creator]
 *                 description: User role
 *               experienceLevel:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *                 description: Experience level
 *               goals:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Learning goals
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Personal interests
 *               learningPreferences:
 *                 $ref: '#/components/schemas/LearningPreferences'
 *               privacySettings:
 *                 $ref: '#/components/schemas/PrivacySettings'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Profile updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     profile:
 *                       $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/profile/change-password:
 *   post:
 *     summary: Change user password
 *     description: Change the authenticated user's password. Requires current password verification
 *     tags: [Profile]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 maxLength: 128
 *                 description: Current password for verification
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 maxLength: 128
 *                 pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)'
 *                 description: New password (must contain uppercase, lowercase, and number)
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Password changed successfully"
 *       400:
 *         description: Invalid current password or weak new password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/profile/avatar:
 *   post:
 *     summary: Upload profile avatar
 *     description: Upload a new avatar image for the authenticated user
 *     tags: [Profile, Upload]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image file (JPEG, PNG, WebP, GIF, max 2MB)
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Avatar uploaded successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     avatarUrl:
 *                       type: string
 *                       description: URL of the uploaded avatar
 *                     fileSize:
 *                       type: number
 *                       description: File size in bytes
 *                     profile:
 *                       $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: No file uploaded or invalid file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Upload failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/profile/document:
 *   post:
 *     summary: Upload profile document
 *     description: Upload documents such as certificates, resumes, or portfolios
 *     tags: [Profile, Upload]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Document file (PDF, DOC, DOCX, TXT, max 10MB)
 *               documentType:
 *                 type: string
 *                 enum: [certificate, resume, portfolio, general]
 *                 description: Type of document being uploaded
 *               name:
 *                 type: string
 *                 description: Document name (for certificates)
 *               description:
 *                 type: string
 *                 description: Document description (for certificates)
 *               issueDate:
 *                 type: string
 *                 format: date
 *                 description: Issue date (for certificates)
 *     responses:
 *       200:
 *         description: Document uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Document uploaded successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     documentUrl:
 *                       type: string
 *                       description: URL of the uploaded document
 *                     documentType:
 *                       type: string
 *                       description: Type of document uploaded
 *                     fileSize:
 *                       type: number
 *                       description: File size in bytes
 *                     profile:
 *                       $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Invalid document type or file format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       413:
 *         description: File too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Upload failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/profile/file/{fileType}/{fileKey}:
 *   delete:
 *     summary: Delete profile file
 *     description: Delete an uploaded avatar or document file
 *     tags: [Profile, Upload]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [avatar, document]
 *         description: Type of file to delete
 *       - in: path
 *         name: fileKey
 *         required: true
 *         schema:
 *           type: string
 *         description: File key/identifier
 *     responses:
 *       200:
 *         description: File deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "File deleted successfully"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden - File doesn't belong to user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: File not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Delete failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
/**
 * @route GET /api/profile/test
 * @desc Test profile database connectivity and user status
 * @access Private
 */
router.get('/test', async (req: any, res: any) => {
  res.json({
    success: true,
    message: 'Test endpoint',
    data: { test: 'working' }
  });
});

/**
 * @route PUT /api/profile
 * @desc Update user profile
 * @access Private
 */
router.put('/', validateProfileUpdate, profileController.updateProfile);

/**
 * @route POST /api/profile/change-password
 * @desc Change password
 * @access Private
 */
router.post('/change-password', validateChangePassword, profileController.changePassword);

/**
 * @route POST /api/profile/avatar-optimized
 * @desc Upload avatar using high-performance service (direct Supabase, optimized)
 * @access Private
 * @requestBody
 *   required: true
 *   content:
 *     multipart/form-data:
 *       schema:
 *         type: object
 *         required:
 *           - avatar
 *         properties:
 *           avatar:
 *             type: string
 *             format: binary
 *             description: Avatar image file (JPEG, PNG, WebP, max 5MB)
 * @responses
 *   200:
 *     description: Avatar uploaded successfully
 *     content:
 *       application/json:
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *               example: true
 *             message:
 *               type: string
 *               example: "Avatar uploaded successfully (optimized)"
 *             data:
 *               type: object
 *               properties:
 *                 avatarUrl:
 *                   type: string
 *                   description: URL of the uploaded avatar
 *                 uploadMethod:
 *                   type: string
 *                   example: "supabase-optimized"
 *                 fileSize:
 *                   type: number
 *                   description: File size in bytes
 *   400:
 *     description: Invalid file or no file provided
 *   401:
 *     description: Unauthorized
 *   500:
 *     description: Upload failed
 */
router.post('/avatar-optimized', (req: AuthRequest, res: any, next) => {
  console.log('🚀 Optimized avatar upload route called');
  console.log('🌐 Content-Type:', req.headers['content-type']);
  console.log('📋 Body keys:', Object.keys(req.body));

  // Use multer middleware to process the file
  avatarUpload.single('avatar')(req, res, async (err: any) => {
    if (err) {
      console.error('❌ Multer error:', err.message);
      res.status(400).json({
        success: false,
        message: err.message
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No avatar file provided'
      });
      return;
    }

    console.log('📄 Optimized upload - File details:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    try {
      // Use the high-performance avatar upload service
      const avatarUrl = await avatarUploadService.uploadAvatar(req.user!._id, req.file);

      res.json({
        success: true,
        message: 'Avatar uploaded successfully (optimized)',
        data: {
          avatarUrl,
          uploadMethod: 'supabase-optimized',
          fileSize: req.file.size
        }
      });

    } catch (error) {
      console.error('❌ Optimized avatar upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload avatar (optimized)',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  });
});

/**
 * @route POST /api/profile/document
 * @desc Upload profile document
 * @access Private
 */
router.post('/document', documentUpload.single('document'), profileUploadService.uploadDocument);

/**
 * @route DELETE /api/profile/file/:fileType/:fileKey
 * @desc Delete profile file
 * @access Private
 */
router.delete('/file/:fileType/:fileKey', profileUploadService.deleteFile);

/**
 * @route GET /api/profile/file/:fileKey
 * @desc Get file URL with authentication
 * @access Private
 */
router.get('/file/:fileKey', profileUploadService.getFileUrl);

/**
 * @route GET /api/profile/test-upload
 * @desc Test endpoint for debugging upload issues
 * @access Private
 */
router.get('/test-upload', (req: any, res: any) => {
  console.log('🧪 Test upload endpoint called');
  console.log('🌐 Content-Type:', req.headers['content-type']);
  console.log('📋 Body keys:', Object.keys(req.body));
  console.log('📎 Has file:', !!req.file);

  res.json({
    success: true,
    message: 'Test endpoint reached',
    data: {
      contentType: req.headers['content-type'],
      bodyKeys: Object.keys(req.body),
      hasFile: !!req.file
    }
  });
});

export default router;
