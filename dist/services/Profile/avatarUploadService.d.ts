/**
 * High-Performance Avatar Upload Service for Supabase Storage
 *
 * Features:
 * - Direct Supabase Storage uploads (no local disk I/O)
 * - Image validation and optimization
 * - Atomic database operations
 * - High concurrency support
 * - Comprehensive error handling and logging
 * - Automatic cleanup of old avatars
 */
export declare class AvatarUploadService {
    private supabase;
    private readonly BUCKET_NAME;
    private readonly MAX_FILE_SIZE;
    private readonly ALLOWED_FORMATS;
    private readonly MAX_DIMENSION;
    private readonly OPTIMAL_SIZE;
    constructor();
    /**
     * High-performance avatar upload with direct Supabase Storage integration
     *
     * @param userId - Validated and authenticated user ID
     * @param file - Multer file object (Express.Multer.File)
     * @returns Promise<string> - Public URL of uploaded avatar
     *
     * Features:
     * - Zero local disk I/O - direct stream upload
     * - Image validation and optimization
     * - Atomic database updates with rollback
     * - Automatic cleanup of old avatars
     * - Optimized for sub-50ms database operations
     * - Handles millions of concurrent requests
     */
    uploadAvatar(userId: string, file: Express.Multer.File): Promise<string>;
    /**
     * Pre-flight validation - fast, in-memory checks
     */
    private validateAvatarFile;
    /**
     * Optimize image for avatar use - in-memory processing
     */
    private optimizeImage;
    /**
     * Generate secure, unique filename with user context
     */
    private generateSecureFileName;
    /**
     * Atomic upload and database update operation
     */
    private performAtomicUpload;
    /**
     * Direct Supabase Storage upload - no local disk I/O
     */
    private uploadToSupabase;
    /**
     * Ensure Supabase bucket exists with proper configuration
     */
    private ensureBucketExists;
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
    /**
     * Batch upload multiple avatars (for admin operations)
     */
    batchUploadAvatars(uploads: Array<{
        userId: string;
        file: Express.Multer.File;
    }>): Promise<Array<{
        userId: string;
        url: string;
        success: boolean;
        error?: string;
    }>>;
    /**
     * Get upload statistics for monitoring
     */
    getUploadStats(): Promise<{
        totalUploads: number;
        averageProcessingTime: number;
        successRate: number;
        errorRate: number;
    }>;
}
/**
 * Singleton instance for high-performance operations
 */
export declare const avatarUploadService: AvatarUploadService;
/**
 * Legacy compatibility function - maintains backward compatibility
 */
export declare function uploadAvatar(userId: string, file: Express.Multer.File): Promise<string>;
//# sourceMappingURL=avatarUploadService.d.ts.map