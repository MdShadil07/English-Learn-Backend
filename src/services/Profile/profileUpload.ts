import { Request, Response } from 'express';
import { cloudStorage } from './cloudStorage.js';
import { profileService } from './profileService.js';
import { UserProfile } from '../../models/index.js';

interface AuthRequest extends Request {
  user?: {
    _id: string;
    email: string;
    role: string;
  };
}

export class ProfileUploadService {
  /**
   * Upload and update user avatar
   * Supports both direct file uploads and Supabase URL updates
   */
  async uploadAvatar(req: AuthRequest, res: Response): Promise<void> {
    let avatarUrl: string = '';
    let oldAvatarKey: string | null = null;

    try {
      const userId = req.user!._id;

      console.log('📸 UploadAvatar service called for user:', userId);
      console.log('📋 Request body:', req.body);
      console.log('📎 Request file:', req.file);
      console.log('👤 User details:', {
        id: req.user?._id || 'undefined',
        email: req.user?.email || 'undefined',
        role: req.user?.role || 'undefined'
      });

      // Get current avatar for cleanup before uploading new one
      const currentProfile = await profileService.getProfile(userId);
      oldAvatarKey = currentProfile?.avatar_url ?
        this.extractFileKeyFromUrl(currentProfile.avatar_url) : null;

      // Check if this is a Supabase URL update (from frontend direct upload)
      if (req.body.avatarUrl && typeof req.body.avatarUrl === 'string') {
        avatarUrl = req.body.avatarUrl;

        // Basic URL validation
        if (!avatarUrl.startsWith('https://') && !avatarUrl.startsWith('http://')) {
          res.status(400).json({
            success: false,
            message: 'Invalid avatar URL format'
          });
          return;
        }

        console.log('📸 Using Supabase URL for avatar update:', avatarUrl);
      } else if (req.file) {
        // Traditional file upload (backward compatibility)
        console.log('📸 Processing uploaded file:', req.file.originalname, req.file.size, 'bytes');

        // Upload file to cloud storage
        const uploadResult = await cloudStorage.uploadFile(req.file, 'avatars');
        avatarUrl = uploadResult.url;

        console.log('📸 Uploaded file to cloud storage:', avatarUrl);
      } else {
        console.log('❌ No avatar URL or file provided');
        console.log('❌ Request details:', {
          bodyKeys: Object.keys(req.body),
          hasFile: !!req.file,
          contentType: req.headers['content-type']
        });
        res.status(400).json({
          success: false,
          message: 'No avatar URL or file provided'
        });
        return;
      }

      // Update user profile with new avatar URL
      const updateResult = await profileService.updateProfile(
        userId,
        { avatar_url: avatarUrl },
        userId
      );

      if (!updateResult) {
        console.error('❌ Profile update failed - profileService returned null');
        console.error('📋 Update data:', { avatar_url: avatarUrl });
        console.error('👤 User ID:', userId);

        res.status(404).json({
          success: false,
          message: 'Profile not found'
        });
        return;
      }

      // Background cleanup of old avatar (non-blocking)
      if (oldAvatarKey) {
        // Extract file key from new avatar URL for proper comparison
        const newFileKey = this.extractFileKeyFromUrl(avatarUrl);
        if (newFileKey && oldAvatarKey !== newFileKey) {
          this.cleanupOldAvatar(userId, oldAvatarKey).catch(error => {
            console.warn('Background cleanup failed:', error);
          });
        } else {
          console.log('✨ No cleanup needed - avatar URL unchanged');
        }
      }

      console.log('✅ Profile updated successfully:', {
        userId,
        avatarUrl,
        updateResult: updateResult ? 'Profile data received' : 'No profile data'
      });

      res.json({
        success: true,
        message: 'Avatar updated successfully',
        data: {
          avatarUrl,
          fileSize: req.file?.size,
          profile: updateResult
        }
      });

    } catch (error) {
      console.error('❌ Avatar upload service error:', error);

      // Cleanup any uploaded file if database update failed
      if (avatarUrl && req.file) {
        this.cleanupFailedUpload(avatarUrl).catch(cleanupError => {
          console.error('Failed cleanup after error:', cleanupError);
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to upload avatar',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      });
    }
  }

  /**
   * Upload and update profile documents (certificates, etc.)
   */
  async uploadDocument(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
        return;
      }

      const userId = req.user!._id;

      const documentType = req.body.documentType || 'general';

      // Validate document type
      const allowedTypes = ['certificate', 'resume', 'portfolio', 'general'];
      if (!allowedTypes.includes(documentType)) {
        res.status(400).json({
          success: false,
          message: `Invalid document type. Allowed types: ${allowedTypes.join(', ')}`
        });
        return;
      }

      // Upload file to cloud storage
      const uploadResult = await cloudStorage.uploadFile(req.file, `documents/${documentType}`);

      // Update user profile based on document type
      let updateData: any = {};
      switch (documentType) {
        case 'certificate':
          updateData = {
            certifications: [{
              name: req.body.name || req.file.originalname,
              credentialUrl: uploadResult.url,
              issueDate: req.body.issueDate ? new Date(req.body.issueDate) : new Date(),
              description: req.body.description || '',
              isVerified: false
            }]
          };
          break;
        case 'resume':
          updateData = {
            professionalInfo: {
              resumeUrl: uploadResult.url
            }
          };
          break;
        case 'portfolio':
          updateData = {
            socialLinks: {
              portfolio: uploadResult.url
            }
          };
          break;
        default:
          // For general documents, just store the URL
          updateData = {
            documents: [{
              name: req.file.originalname,
              url: uploadResult.url,
              type: documentType,
              uploadedAt: new Date()
            }]
          };
      }

      const updateResult = await profileService.updateProfile(
        userId,
        updateData,
        userId
      );

      res.json({
        success: true,
        message: 'Document uploaded successfully',
        data: {
          documentUrl: uploadResult.url,
          documentType,
          fileSize: uploadResult.size,
          profile: updateResult
        }
      });

    } catch (error) {
      console.error('Document upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload document'
      });
    }
  }

  /**
   * Delete avatar or document
   */
  async deleteFile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!._id;
      const { fileKey, fileType } = req.params;

      if (!fileKey) {
        res.status(400).json({
          success: false,
          message: 'File key is required'
        });
        return;
      }

      // Get user profile to verify ownership
      const profile = await profileService.getProfile(userId);
      if (!profile) {
        res.status(404).json({
          success: false,
          message: 'Profile not found'
        });
        return;
      }

      // Verify file ownership (basic security check)
      let fileUrl = '';
      if (fileType === 'avatar' && profile.avatar_url) {
        fileUrl = profile.avatar_url;
      } else if (fileType === 'document') {
        // Check if document belongs to user
        const document = profile.documents?.find((doc: any) => doc.url?.includes(fileKey));
        if (document) {
          fileUrl = document.url;
        }
      }

      if (!fileUrl || !fileUrl.includes(fileKey)) {
        res.status(403).json({
          success: false,
          message: 'Unauthorized to delete this file'
        });
        return;
      }

      // Delete from cloud storage
      await cloudStorage.deleteFile(fileKey);

      // Update profile to remove file reference
      let updateData: any = {};
      if (fileType === 'avatar') {
        updateData = { avatar_url: null };
      } else if (fileType === 'document') {
        updateData = {
          documents: profile.documents?.filter((doc: any) => !doc.url?.includes(fileKey))
        };
      }

      await profileService.updateProfile(userId, updateData, userId);

      res.json({
        success: true,
        message: 'File deleted successfully'
      });

    } catch (error) {
      console.error('File delete error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete file'
      });
    }
  }

  /**
   * Get file URL with authentication
   */
  async getFileUrl(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { fileKey } = req.params;
      const expiresIn = parseInt(req.query.expiresIn as string) || 3600; // 1 hour default

      if (!fileKey) {
        res.status(400).json({
          success: false,
          message: 'File key is required'
        });
        return;
      }

      const fileUrl = await cloudStorage.getFileUrl(fileKey, expiresIn);

      res.json({
        success: true,
        data: {
          url: fileUrl,
          expiresIn
        }
      });

    } catch (error) {
      console.error('Get file URL error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get file URL'
      });
    }
  }

  /**
   * Extract file key from Supabase URL for cleanup
   */
  private extractFileKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');

      // Remove empty parts and the 'public' part if present
      const filteredParts = pathParts.filter(part => part && part !== 'public');

      // Extract the path starting from the bucket name
      // URL format: /storage/v1/object/public/{bucket}/{path}
      // We want: {bucket}/{path} or just {path} depending on storage structure
      const bucketIndex = filteredParts.indexOf('uploads'); // Find where the actual path starts
      if (bucketIndex !== -1) {
        return filteredParts.slice(bucketIndex).join('/');
      }

      return filteredParts.join('/');
    } catch {
      return null;
    }
  }

  /**
   * Background cleanup of old avatar (non-blocking)
   */
  private async cleanupOldAvatar(userId: string, oldKey: string): Promise<void> {
    try {
      // Use cloudStorage service for cleanup to maintain consistency
      await cloudStorage.cleanupOldFiles(userId, oldKey, 'avatars');
      console.log(`🧹 Cleaned up old avatar: ${oldKey}`);
    } catch (error) {
      console.warn(`Cleanup warning for user ${userId}:`, error);
      // Don't throw - cleanup failures shouldn't affect the main operation
    }
  }

  /**
   * Cleanup failed upload (emergency cleanup)
   */
  private async cleanupFailedUpload(url: string): Promise<void> {
    try {
      const fileKey = this.extractFileKeyFromUrl(url);
      if (fileKey) {
        await cloudStorage.deleteFile(fileKey);
        console.log(`🧹 Emergency cleanup: removed failed upload ${fileKey}`);
      }
    } catch (error) {
      console.error(`Emergency cleanup failed:`, error);
      // Don't throw - this is already in error recovery
    }
  }
}

export const profileUploadService = new ProfileUploadService();
