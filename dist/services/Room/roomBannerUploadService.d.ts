/**
 * Service for handling Practice Room banner uploads to Supabase.
 * Isolated from user profile services to maintain architectural boundaries.
 */
export declare class RoomBannerUploadService {
    private supabase;
    private readonly BUCKET_NAME;
    private readonly MAX_FILE_SIZE;
    private readonly ALLOWED_FORMATS;
    private readonly MAX_WIDTH;
    private readonly MAX_HEIGHT;
    constructor();
    /**
     * High-performance banner upload directly to Supabase Storage
     * Returns the public URL of the uploaded banner
     */
    uploadBanner(file: Express.Multer.File, userId: string): Promise<string>;
    private validateFile;
    private optimizeBannerImage;
    private generateFileName;
    private uploadToSupabase;
    private ensureBucketExists;
}
export declare const roomBannerUploadService: RoomBannerUploadService;
//# sourceMappingURL=roomBannerUploadService.d.ts.map