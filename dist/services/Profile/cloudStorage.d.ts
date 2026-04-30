declare class CloudStorageService {
    private supabase;
    private config;
    constructor();
    private loadConfig;
    private initializeClient;
    /**
     * Ensure the required bucket exists in Supabase
     */
    private ensureBucketExists;
    uploadFile(file: Express.Multer.File, folder?: string): Promise<{
        url: string;
        key: string;
        size: number;
    }>;
    private uploadToLocal;
    private uploadToSupabase;
    deleteFile(key: string): Promise<void>;
    getFileUrl(key: string, expiresIn?: number): Promise<string>;
    private generateFileName;
    getFileMetadata(key: string): Promise<any>;
    /**
     * Clean up old files (useful for profile picture updates)
     */
    cleanupOldFiles(userId: string, oldKey: string, folder?: string, currentKey?: string): Promise<void>;
    /**
     * Clean up old avatar files specifically - with proper user isolation
     * Only deletes old files from the CURRENT USER's folder
     */
    private cleanupOldAvatars;
    /**
     * Generic cleanup for other file types
     */
    private cleanupOldFilesGeneric;
}
export declare const cloudStorage: CloudStorageService;
export default cloudStorage;
//# sourceMappingURL=cloudStorage.d.ts.map