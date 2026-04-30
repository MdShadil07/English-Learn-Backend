import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth/auth.js';
export declare class ProfileUploadService {
    /**
     * Upload and update user avatar
     * Supports both direct file uploads and Supabase URL updates
     */
    uploadAvatar(req: AuthRequest, res: Response): Promise<void>;
    /**
     * Upload and update profile documents (certificates, etc.)
     */
    uploadDocument(req: AuthRequest, res: Response): Promise<void>;
    /**
     * Delete avatar or document
     */
    deleteFile(req: AuthRequest, res: Response): Promise<void>;
    /**
     * Get file URL with authentication
     */
    getFileUrl(req: AuthRequest, res: Response): Promise<void>;
    /**
     * Extract file key from Supabase URL for cleanup
     */
    private extractFileKeyFromUrl;
    /**
     * Background cleanup of old avatar (non-blocking)
     */
    private cleanupOldAvatar;
    /**
     * Cleanup failed upload (emergency cleanup)
     */
    private cleanupFailedUpload;
}
export declare const profileUploadService: ProfileUploadService;
//# sourceMappingURL=profileUpload.d.ts.map