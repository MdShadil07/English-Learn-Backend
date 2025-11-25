import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

interface CloudStorageConfig {
  provider: 'supabase' | 'local';
  supabaseUrl?: string;
  supabaseKey?: string;
  bucket?: string;
  uploadPath?: string;
}

class CloudStorageService {
  private supabase: SupabaseClient | null = null;
  private config: CloudStorageConfig;

  constructor() {
    this.config = this.loadConfig();
    this.initializeClient();
  }

  private loadConfig(): CloudStorageConfig {
    return {
      provider: (process.env.CLOUD_STORAGE_PROVIDER as any) || 'supabase',
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      bucket: process.env.SUPABASE_BUCKET || 'uploads', // Use same bucket as avatarUploadService
      uploadPath: process.env.UPLOAD_PATH || './uploads'
    };
  }

  private initializeClient(): void {
    if (this.config.provider === 'supabase' && this.config.supabaseUrl && this.config.supabaseKey) {
      this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      // Check and create bucket if needed
      this.ensureBucketExists();
    }
  }

  /**
   * Ensure the required bucket exists in Supabase
   */
  private async ensureBucketExists(): Promise<void> {
    if (!this.supabase || !this.config.bucket) return;

    try {
      // Check if bucket exists
      const { data: buckets, error: bucketsError } = await this.supabase.storage.listBuckets();

      if (bucketsError) {
        console.error('Error checking buckets:', bucketsError);
        return;
      }

      const bucketExists = buckets?.some((bucket: { name: string | undefined; }) => bucket.name === this.config.bucket);

      if (!bucketExists) {
        console.log(`📦 Creating Supabase bucket '${this.config.bucket}'...`);

        // Create the bucket with public access
        const { error: createError } = await this.supabase.storage.createBucket(this.config.bucket, {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
          fileSizeLimit: 5242880 // 5MB
        });

        if (createError) {
          console.error('Error creating bucket:', createError);
          console.log('💡 Please create the bucket manually in your Supabase dashboard:');
          console.log(`   1. Go to https://supabase.com/dashboard/project/${this.config.supabaseUrl?.split('/').pop()}/storage`);
          console.log(`   2. Create a new bucket named '${this.config.bucket}'`);
          console.log(`   3. Set it to public and allow image uploads`);
        } else {
          console.log(`✅ Successfully created bucket '${this.config.bucket}'`);
        }
      } else {
        console.log(`✅ Bucket '${this.config.bucket}' already exists`);
      }
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<{ url: string; key: string; size: number }> {
    try {
      if (this.config.provider === 'local') {
        return await this.uploadToLocal(file, folder);
      } else if (this.config.provider === 'supabase' && this.supabase) {
        return await this.uploadToSupabase(file, folder);
      }

      throw new Error(`Unsupported cloud storage provider: ${this.config.provider}`);
    } catch (error) {
      console.error('Cloud storage upload error:', error);
      throw new Error('Failed to upload file');
    }
  }

  private async uploadToLocal(file: Express.Multer.File, folder: string): Promise<{ url: string; key: string; size: number }> {
    const uploadDir = path.join(this.config.uploadPath!, folder);

    // Ensure directory exists
    await promisify(fs.mkdir)(uploadDir, { recursive: true });

    // Generate unique filename
    const fileName = this.generateFileName(file.originalname);
    const filePath = path.join(uploadDir, fileName);

    // For memory storage, write buffer to disk
    if (file.buffer) {
      await promisify(fs.writeFile)(filePath, file.buffer);
    } else if (file.path) {
      // For disk storage, move file to correct location
      const finalPath = path.join(uploadDir, fileName);
      await promisify(fs.rename)(file.path, finalPath);
    }

    return {
      url: `/api/files/${folder}/${fileName}`,
      key: `${folder}/${fileName}`,
      size: file.size
    };
  }

  private async uploadToSupabase(file: Express.Multer.File, folder: string): Promise<{ url: string; key: string; size: number }> {
    if (!this.supabase || !this.config.bucket) {
      throw new Error('Supabase client not initialized or bucket not configured');
    }

    const fileName = this.generateFileName(file.originalname);
    const filePath = `${folder}/${fileName}`;

    // First check if the bucket exists
    const { data: buckets, error: bucketsError } = await this.supabase.storage.listBuckets();

    if (bucketsError) {
      console.error('Error checking buckets:', bucketsError);
      throw new Error(`Failed to access Supabase storage: ${bucketsError.message}`);
    }

    const bucketExists = buckets?.some((bucket: { name: string | undefined; }) => bucket.name === this.config.bucket);

    if (!bucketExists) {
      console.error(`Bucket '${this.config.bucket}' not found. Available buckets:`, buckets?.map((b: { name: any; }) => b.name));
      throw new Error(`Storage bucket '${this.config.bucket}' not found. Please create it in your Supabase dashboard.`);
    }

    // Upload file to Supabase storage
    const { data, error } = await this.supabase.storage
      .from(this.config.bucket)
      .upload(filePath, file.buffer || fs.createReadStream(file.path), {
        contentType: file.mimetype,
        cacheControl: '3600', // 1 hour cache
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(`Failed to upload file to Supabase: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = this.supabase.storage
      .from(this.config.bucket)
      .getPublicUrl(filePath);

    return {
      url: publicUrl,
      key: filePath,
      size: file.size
    };
  }

  async deleteFile(key: string): Promise<void> {
    try {
      if (this.config.provider === 'local') {
        const filePath = path.join(this.config.uploadPath!, key);
        if (fs.existsSync(filePath)) {
          await promisify(fs.unlink)(filePath);
        }
      } else if (this.config.provider === 'supabase' && this.supabase && this.config.bucket) {
        const { error } = await this.supabase.storage
          .from(this.config.bucket)
          .remove([key]);

        if (error) {
          console.error('Supabase delete error:', error);
          throw new Error(`Failed to delete file from Supabase: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('Cloud storage delete error:', error);
      throw new Error('Failed to delete file');
    }
  }

  async getFileUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      if (this.config.provider === 'local') {
        return `/api/files/${key}`;
      } else if (this.config.provider === 'supabase' && this.supabase && this.config.bucket) {
        const { data } = this.supabase.storage
          .from(this.config.bucket)
          .getPublicUrl(key);

        return data.publicUrl;
      }

      throw new Error(`Unsupported cloud storage provider: ${this.config.provider}`);
    } catch (error) {
      console.error('Cloud storage get URL error:', error);
      throw new Error('Failed to get file URL');
    }
  }

  private generateFileName(originalName: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const sanitizedName = originalName
      .replace(/[^a-zA-Z0-9.-_]/g, '_')
      .substring(0, 50);

    return `${timestamp}_${randomString}_${sanitizedName}`;
  }

  async getFileMetadata(key: string): Promise<any> {
    try {
      if (this.config.provider === 'local') {
        const filePath = path.join(this.config.uploadPath!, key);
        const stats = await promisify(fs.stat)(filePath);

        return {
          size: stats.size,
          lastModified: stats.mtime,
          created: stats.birthtime
        };
      } else if (this.config.provider === 'supabase' && this.supabase && this.config.bucket) {
        // Get file info from Supabase
        const { data, error } = await this.supabase.storage
          .from(this.config.bucket)
          .list(key.substring(0, key.lastIndexOf('/')), {
            search: key.substring(key.lastIndexOf('/') + 1)
          });

        if (error || !data || data.length === 0) {
          throw new Error('File not found');
        }

        const file = data[0];
        return {
          size: file.metadata?.size || 0,
          lastModified: new Date(file.updated_at || file.created_at),
          created: new Date(file.created_at)
        };
      }

      throw new Error(`Unsupported cloud storage provider: ${this.config.provider}`);
    } catch (error) {
      console.error('Cloud storage get metadata error:', error);
      return null;
    }
  }

  /**
   * Clean up old files (useful for profile picture updates)
   */
  async cleanupOldFiles(userId: string, oldKey: string, folder: string = 'avatars', currentKey?: string): Promise<void> {
    try {
      if (this.config.provider === 'supabase' && this.supabase && this.config.bucket) {
        if (folder === 'avatars') {
          // Special handling for avatar cleanup - search in all user subdirectories
          if (currentKey) {
            await this.cleanupOldAvatars(userId, currentKey);
          }
        } else {
          // Regular cleanup for other file types
          if (currentKey) {
            await this.cleanupOldFilesGeneric(userId, currentKey, folder);
          }
        }
      }
    } catch (error) {
      console.error('File cleanup error:', error);
    }
  }

  /**
   * Clean up old avatar files specifically - with proper user isolation
   * Only deletes old files from the CURRENT USER's folder
   */
  private async cleanupOldAvatars(userId: string, currentKey: string): Promise<void> {
    try {
      console.log(`🧹 Starting avatar cleanup for user ${userId}`);
      console.log(`📁 Current avatar key: ${currentKey}`);

      // First, validate that the current avatar exists
      const currentFileName = currentKey.split('/').pop();
      if (!currentFileName) {
        console.error(`❌ Invalid current avatar key: ${currentKey}`);
        return;
      }

      // Extract the exact user-specific folder path from the current key
      // Current key format: avatars/{userHash}/{timestamp}_{randomBytes}.{ext}
      const currentKeyParts = currentKey.split('/');
      if (currentKeyParts.length < 3) {
        console.error(`❌ Invalid current key format: ${currentKey}`);
        return;
      }

      // Get the user's folder path (avatars/{userHash})
      const userFolderPath = `${currentKeyParts[0]}/${currentKeyParts[1]}`;
      console.log(`👤 User folder path: ${userFolderPath}`);

      // List files ONLY in this specific user's folder (NOT all avatars/)
      const { data: userFiles, error } = await this.supabase!.storage
        .from(this.config.bucket!)
        .list(userFolderPath);

      if (error) {
        console.error(`Error listing files in user folder ${userFolderPath}:`, error);
        return;
      }

      if (!userFiles || userFiles.length === 0) {
        console.log(`📂 No files found in user folder ${userFolderPath}`);
        return;
      }

      console.log(`📄 Found ${userFiles.length} files in ${userFolderPath}: ${userFiles.map((f: any) => f.name).join(', ')}`);

      // Delete all files EXCEPT the current one from THIS USER'S FOLDER ONLY
      const filesToDelete = userFiles
        .filter((file: any) => {
          // Only delete if it's not the current file
          const shouldDelete = file.name !== currentFileName && file.name;
          console.log(`🔍 Comparing: ${file.name} !== ${currentFileName} = ${shouldDelete}`);
          return shouldDelete;
        })
        .map((file: any) => `${userFolderPath}/${file.name}`);

      if (filesToDelete.length > 0) {
        console.log(`🧹 Cleaning up ${filesToDelete.length} old avatar(s) for user ${userId}`);
        console.log(`📁 Current file: ${currentKey} (filename: ${currentFileName})`);
        console.log(`🗑️ Files to delete: ${filesToDelete.join(', ')}`);

        const { error: deleteError } = await this.supabase!.storage
          .from(this.config.bucket!)
          .remove(filesToDelete);

        if (deleteError) {
          console.error('Error deleting old avatar files:', deleteError);
        } else {
          console.log(`✅ Successfully cleaned up ${filesToDelete.length} old avatar(s) for user ${userId}`);
        }
      } else {
        console.log(`✨ No old avatars to clean up for user ${userId} - only current file exists: ${currentFileName}`);
      }
    } catch (error) {
      console.error('Avatar cleanup error:', error);
    }
  }

  /**
   * Generic cleanup for other file types
   */
  private async cleanupOldFilesGeneric(userId: string, currentKey: string, folder: string): Promise<void> {
    try {
      // List all files in the user's folder
      const { data: files, error } = await this.supabase!.storage
        .from(this.config.bucket!)
        .list(folder, {
          search: userId
        });

      if (error) {
        console.error('Error listing files for cleanup:', error);
        return;
      }

      if (files && files.length > 0) {
        // Delete files that are not the current one
        const filesToDelete = files
          .filter((file: any) => file.name !== currentKey.split('/').pop())
          .map((file: any) => `${folder}/${file.name}`);

        if (filesToDelete.length > 0) {
          const { error: deleteError } = await this.supabase!.storage
            .from(this.config.bucket!)
            .remove(filesToDelete);

          if (deleteError) {
            console.error('Error deleting old files:', deleteError);
          } else {
            console.log(`Cleaned up ${filesToDelete.length} old files for user ${userId}`);
          }
        }
      }
    } catch (error) {
      console.error('Generic file cleanup error:', error);
    }
  }
}

export const cloudStorage = new CloudStorageService();
export default cloudStorage;
