import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  DeleteObjectCommand,
  GetBucketLocationCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs/promises';
import * as path from 'path';
import { telemetryService } from '../../services/telemetryService.js';

type StorageProvider = 'supabase' | 'local' | 's3';

interface UploadBufferParams {
  key: string;
  buffer: Buffer;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

interface UploadFileParams {
  key: string;
  filePath: string;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}

class ObjectStorageService {
  private readonly provider: StorageProvider;
  private readonly bucket: string;
  private readonly uploadPath: string;
  private readonly supabase: SupabaseClient | null;
  private s3: S3Client | null;
  private s3Region: string;
  private readonly s3BootstrapRegion: string;
  private s3RegionResolved = false;

  constructor() {
    this.provider = (process.env.OBJECT_STORAGE_PROVIDER || process.env.CLOUD_STORAGE_PROVIDER || 'local') as StorageProvider;
    this.bucket = process.env.OBJECT_STORAGE_BUCKET || process.env.SUPABASE_BUCKET || 'uploads';
    this.uploadPath = process.env.OBJECT_STORAGE_PATH || process.env.UPLOAD_PATH || './uploads';
    this.s3BootstrapRegion = process.env.AWS_S3_REGION || process.env.OBJECT_STORAGE_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
    this.s3Region = this.s3BootstrapRegion;
    this.supabase = this.provider === 'supabase' && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      : null;
    this.s3 = this.provider === 's3'
      ? new S3Client({
          region: this.s3Region,
          credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                sessionToken: process.env.AWS_SESSION_TOKEN,
              }
            : undefined,
        })
      : null;
  }

  private normalizeBucketRegion(locationConstraint: string | undefined | null): string {
    if (!locationConstraint || locationConstraint === 'us-east-1') {
      return 'us-east-1';
    }

    if (locationConstraint === 'EU') {
      return 'eu-west-1';
    }

    return locationConstraint;
  }

  private async getS3Client(): Promise<S3Client | null> {
    if (this.provider !== 's3' || !this.s3) {
      return null;
    }

    if (!this.s3RegionResolved) {
      try {
        const regionProbe = await this.s3.send(new GetBucketLocationCommand({ Bucket: this.bucket }));
        const resolvedRegion = this.normalizeBucketRegion(regionProbe.LocationConstraint ?? null);

        if (resolvedRegion && resolvedRegion !== this.s3Region) {
          this.s3Region = resolvedRegion;
          this.s3 = new S3Client({
            region: this.s3Region,
            credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
              ? {
                  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                  sessionToken: process.env.AWS_SESSION_TOKEN,
                }
              : undefined,
          });
        }
      } catch {
        this.s3Region = this.s3BootstrapRegion;
      } finally {
        this.s3RegionResolved = true;
      }
    }

    return this.s3;
  }

  async uploadBuffer({ key, buffer, contentType, cacheControl = '3600', metadata = {} }: UploadBufferParams) {
    const s3Client = await this.getS3Client();
    const start = Date.now();

    if (this.provider === 's3' && s3Client) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          CacheControl: cacheControl,
          Metadata: metadata,
        });
        await s3Client.send(command);
        telemetryService.recordServiceCall('aws-s3', Date.now() - start, false);
        return { key, url: await this.getPublicUrl(key), size: buffer.byteLength };
      } catch (error) {
        telemetryService.recordServiceCall('aws-s3', Date.now() - start, true);
        throw error;
      }
    }

    if (this.provider === 'supabase' && this.supabase) {
      const { error } = await this.supabase.storage.from(this.bucket).upload(key, buffer, {
        contentType,
        cacheControl,
        metadata,
        upsert: true,
      });
      if (error) {
        telemetryService.recordServiceCall('supabase', Date.now() - start, true);
        throw new Error(`Object storage upload failed: ${error.message}`);
      }

      telemetryService.recordServiceCall('supabase', Date.now() - start, false);
      const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(key);
      return { key, url: data.publicUrl, size: buffer.byteLength };
    }

    const targetPath = path.join(this.uploadPath, key);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, buffer);
    return { key, url: `/api/files/${key.replace(/\\/g, '/')}`, size: buffer.byteLength };
  }

  async uploadFile({ key, filePath, contentType, cacheControl = '3600', metadata = {} }: UploadFileParams) {
    const s3Client = await this.getS3Client();
    const start = Date.now();
    const stat = await fs.stat(filePath);
    const fileStream = (await import('fs')).createReadStream(filePath);

    if (this.provider === 's3' && s3Client) {
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: fileStream,
          ContentType: contentType,
          CacheControl: cacheControl,
          Metadata: metadata,
        });
        await s3Client.send(command);
        telemetryService.recordServiceCall('aws-s3', Date.now() - start, false);
        return { key, url: await this.getPublicUrl(key), size: stat.size };
      } catch (error) {
        telemetryService.recordServiceCall('aws-s3', Date.now() - start, true);
        throw error;
      }
    }

    if (this.provider === 'supabase' && this.supabase) {
      const { error } = await this.supabase.storage.from(this.bucket).upload(key, fileStream as any, {
        contentType,
        cacheControl,
        metadata,
        upsert: true,
      });
      if (error) {
        telemetryService.recordServiceCall('supabase', Date.now() - start, true);
        throw new Error(`Object storage upload failed: ${error.message}`);
      }

      telemetryService.recordServiceCall('supabase', Date.now() - start, false);
      const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(key);
      return { key, url: data.publicUrl, size: stat.size };
    }

    const targetPath = path.join(this.uploadPath, key);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(filePath, targetPath);
    return { key, url: `/api/files/${key.replace(/\\/g, '/')}`, size: stat.size };
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    const s3Client = await this.getS3Client();
    const start = Date.now();

    if (this.provider === 's3' && s3Client) {
      try {
        const { Body } = await s3Client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        if (!Body) {
          throw new Error(`Object storage download failed for ${key}`);
        }

        const chunks: Buffer[] = [];
        for await (const chunk of Body as AsyncIterable<Buffer | Uint8Array | string>) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        telemetryService.recordServiceCall('aws-s3', Date.now() - start, false);
        return Buffer.concat(chunks);
      } catch (error) {
        telemetryService.recordServiceCall('aws-s3', Date.now() - start, true);
        throw error;
      }
    }

    if (this.provider === 'supabase' && this.supabase) {
      const { data, error } = await this.supabase.storage.from(this.bucket).download(key);
      if (error || !data) {
        telemetryService.recordServiceCall('supabase', Date.now() - start, true);
        throw new Error(`Object storage download failed for ${key}`);
      }
      telemetryService.recordServiceCall('supabase', Date.now() - start, false);
      return Buffer.from(await data.arrayBuffer());
    }

    return fs.readFile(path.join(this.uploadPath, key));
  }

  async listKeys(prefix: string): Promise<string[]> {
    const s3Client = await this.getS3Client();

    if (this.provider === 's3' && s3Client) {
      const { Contents } = await s3Client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix }));
      return (Contents || [])
        .map((entry) => entry.Key)
        .filter((key): key is string => Boolean(key));
    }

    if (this.provider === 'supabase' && this.supabase) {
      return this.listSupabaseKeys(prefix);
    }

    const directory = path.join(this.uploadPath, prefix);
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      return entries.filter((entry) => entry.isFile()).map((entry) => `${prefix}/${entry.name}`.replace(/\\/g, '/'));
    } catch {
      return [];
    }
  }

  private async listSupabaseKeys(prefix: string): Promise<string[]> {
    if (!this.supabase) {
      return [];
    }

    const normalizedPrefix = prefix.replace(/\/+$/, '');
    const slashIndex = normalizedPrefix.lastIndexOf('/');
    const folder = slashIndex === -1 ? '' : normalizedPrefix.slice(0, slashIndex);
    const searchPrefix = slashIndex === -1 ? normalizedPrefix : normalizedPrefix.slice(slashIndex + 1);

    const { data, error } = await this.supabase.storage.from(this.bucket).list(folder, {
      limit: 1000,
      search: searchPrefix,
    });

    if (error || !data) {
      return [];
    }

    return data
      .filter((entry) => entry.name.startsWith(searchPrefix))
      .map((entry) => (folder ? `${folder}/${entry.name}` : entry.name).replace(/\\/g, '/'));
  }

  async deleteKeys(keys: string[]): Promise<void> {
    if (!keys.length) {
      return;
    }

    const s3Client = await this.getS3Client();

    if (this.provider === 's3' && s3Client) {
      await Promise.allSettled(
        keys.map(async (key) => {
          try {
            await s3Client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
          } catch {
            return;
          }
        })
      );
      return;
    }

    if (this.provider === 'supabase' && this.supabase) {
      const { error } = await this.supabase.storage.from(this.bucket).remove(keys);
      if (error) {
        throw new Error(`Object storage delete failed: ${error.message}`);
      }
      return;
    }

    await Promise.allSettled(
      keys.map(async (key) => {
        try {
          await fs.unlink(path.join(this.uploadPath, key));
        } catch {
          return;
        }
      })
    );
  }

  async getPublicUrl(key: string): Promise<string> {
    const s3Client = await this.getS3Client();

    if (this.provider === 's3' && s3Client) {
      return `https://${this.bucket}.s3.${this.s3Region}.amazonaws.com/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
    }

    if (this.provider === 'supabase' && this.supabase) {
      const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(key);
      return data.publicUrl;
    }

    return `/api/files/${key.replace(/\\/g, '/')}`;
  }

  async createPresignedUploadUrl(key: string, contentType: string, expiresInSeconds = 900): Promise<string> {
    const s3Client = await this.getS3Client();

    if (this.provider === 's3' && s3Client) {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
    }

    throw new Error('Presigned upload URLs are only supported for S3 storage in the current configuration');
  }

  async objectExists(key: string): Promise<boolean> {
    const s3Client = await this.getS3Client();

    if (this.provider === 's3' && s3Client) {
      try {
        await s3Client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
        return true;
      } catch {
        return false;
      }
    }

    if (this.provider === 'supabase' && this.supabase) {
      const { data } = await this.supabase.storage.from(this.bucket).list(key.substring(0, key.lastIndexOf('/')), {
        search: key.substring(key.lastIndexOf('/') + 1),
      });

      return Boolean(data && data.length > 0);
    }

    try {
      await fs.access(path.join(this.uploadPath, key));
      return true;
    } catch {
      return false;
    }
  }
}

export const objectStorage = new ObjectStorageService();
