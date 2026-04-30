import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';

// Lazy-loaded Sharp module
let sharpModule: any = null;

async function getSharp() {
  if (sharpModule === null) {
    try {
      sharpModule = await import('sharp');
      console.log('✅ Sharp module loaded successfully in BannerUploadService');
    } catch (error) {
      console.warn('⚠️ Sharp module not available in BannerUploadService - image optimization will be disabled:', (error as Error).message);
      sharpModule = false; // Mark as failed to avoid repeated attempts
    }
  }
  return sharpModule === false ? null : sharpModule;
}

/**
 * Service for handling Practice Room banner uploads to Supabase.
 * Isolated from user profile services to maintain architectural boundaries.
 */
export class RoomBannerUploadService {
  private supabase: SupabaseClient;
  private readonly BUCKET_NAME: string;
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_FORMATS = ['jpeg', 'jpg', 'png', 'webp'];
  
  // Custom dimensions for room banners (typically 16:9 or similar rectangular structures)
  private readonly MAX_WIDTH = 1920;
  private readonly MAX_HEIGHT = 1080;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and service role key are required');
    }

    // We can reuse the main "uploads" bucket or use a distinct configured bucket
    this.BUCKET_NAME = process.env.SUPABASE_BUCKET || 'uploads';

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
    });
    
    // Ensure bucket exists on initialization
    this.ensureBucketExists().catch((error) => {
      console.warn('⚠️ Bucket validation failed on startup in BannerUploadService:', error.message);
    });
  }

  /**
   * High-performance banner upload directly to Supabase Storage
   * Returns the public URL of the uploaded banner
   */
  async uploadBanner(file: Express.Multer.File, userId: string): Promise<string> {
    const startTime = performance.now();
    let bannerUrl = '';

    try {
      // 1. Validate file
      await this.validateFile(file);

      // 2. Process and optimize image specifically for banner aesthetics
      const optimizedBuffer = await this.optimizeBannerImage(file);

      // 3. Generate unique filename (placed in a special 'banners' subfolder inside the bucket)
      const fileName = this.generateFileName(file.originalname, userId);

      // 4. Upload to Supabase
      const uploadResult = await this.uploadToSupabase(optimizedBuffer, fileName, 'image/webp');
      
      bannerUrl = uploadResult.publicUrl;

      const endTime = performance.now();
      console.log(`✅ Banner upload completed in ${(endTime - startTime).toFixed(2)}ms`, {
        userId,
        fileSize: file.size,
        optimizedSize: optimizedBuffer.length,
        url: bannerUrl
      });

      return bannerUrl;

    } catch (error) {
      console.error(`❌ Banner upload failed:`, {
        userId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  private async validateFile(file: Express.Multer.File): Promise<void> {
    if (!file.buffer || file.buffer.length === 0) {
      throw new Error(`Invalid file buffer: empty or missing.`);
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new Error(`File size ${file.size} exceeds maximum allowed size ${this.MAX_FILE_SIZE}`);
    }

    const extension = file.originalname.split('.').pop()?.toLowerCase();
    if (!extension || !this.ALLOWED_FORMATS.includes(extension)) {
      throw new Error(`Invalid file extension: ${extension}. Allowed extensions: ${this.ALLOWED_FORMATS.join(', ')}`);
    }
  }

  private async optimizeBannerImage(file: Express.Multer.File): Promise<Buffer> {
    const sharp = await getSharp();
    if (!sharp) {
      console.warn('⚠️ Sharp not available in BannerUploadService - skipping image optimization');
      return file.buffer; // Return original buffer if Sharp not available
    }

    try {
      const metadata = await sharp.default(file.buffer).metadata();

      let processedImage = sharp.default(file.buffer);

      // Scale down only if it exceeds max dimensions
      if (metadata.width! > this.MAX_WIDTH || metadata.height! > this.MAX_HEIGHT) {
        processedImage = processedImage.resize({
          width: this.MAX_WIDTH,
          height: this.MAX_HEIGHT,
          fit: 'inside', // Maintains aspect ratio without cropping
          withoutEnlargement: true
        });
      }

      // Output as WebP for optimal performance over the wire
      return await processedImage
        .webp({ quality: 80, effort: 4 })
        .toBuffer();

    } catch (error) {
      console.error('Banner image optimization failed:', error);
      return file.buffer;
    }
  }

  private generateFileName(originalName: string, userId: string): string {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const userHash = crypto.createHash('sha256').update(userId.toString()).digest('hex').substring(0, 8);
    // Always saving as Webp since we process it
    return `banners/${userHash}/${timestamp}_${randomBytes}.webp`;
  }

  private async uploadToSupabase(buffer: Buffer, fileName: string, mimeType: string): Promise<{ publicUrl: string }> {
    try {
      const { error } = await this.supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, buffer, {
          contentType: mimeType,
          cacheControl: '86400', // 24 hours cache
          upsert: false
        });

      if (error) {
        throw new Error(`Failed to upload to Supabase: ${error.message}`);
      }

      const { data: { publicUrl } } = this.supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(fileName);

      if (!publicUrl) throw new Error('Failed to generate public URL for uploaded banner');

      return { publicUrl };

    } catch (error) {
      throw new Error(`Storage upload failed: ${(error as Error).message}`);
    }
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      const { data: buckets, error } = await this.supabase.storage.listBuckets();
      if (error) throw new Error(`Failed to list buckets: ${error.message}`);
      
      const bucketExists = buckets?.some(bucket => bucket.name === this.BUCKET_NAME);
      if (!bucketExists) {
        await this.supabase.storage.createBucket(this.BUCKET_NAME, {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          fileSizeLimit: this.MAX_FILE_SIZE
        });
      }
    } catch (error) {
      console.error('Bucket creation/validation failed:', error);
    }
  }
}

export const roomBannerUploadService = new RoomBannerUploadService();
