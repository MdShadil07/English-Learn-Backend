import crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PracticeSession, PronunciationUploadSession } from '../../models/index.js';
import type { IPronunciationUploadSession } from '../../models/PronunciationUploadSession.js';
import { objectStorage } from '../Storage/objectStorage.js';
import { pronunciationMetrics } from './pronunciationMetrics.js';
import { metricsPublisher } from '../../utils/metricsPublisher.js';

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_CHUNK_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = parseInt(process.env.MAX_CONCURRENT_UPLOADS || '50', 10);
let activeUploads = 0;

export interface CreateUploadSessionInput {
  sessionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  chunkSizeBytes: number;
  totalChunks: number;
  waveformPeaks?: number[];
  qualityMetrics?: Record<string, unknown>;
  deviceMetadata?: Record<string, unknown>;
  networkMetadata?: Record<string, unknown>;
  validation?: {
    silenceRatio?: number;
    clippedSamplesRatio?: number;
    averageLevel?: number;
    warnings?: string[];
  };
}

export interface CreateUploadSessionResult {
  _id: string;
  practiceSessionId: string;
  uploadToken: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs?: number;
  chunkSizeBytes: number;
  totalChunks: number;
  uploadedParts: number[];
  uploadedBytes: number;
  status: string;
  tempPrefix: string;
  finalObjectKey: string;
  finalAudioUrl: string | null;
  uploadUrl?: string | null;
  uploadMethod?: 's3-presigned-put' | 'legacy-chunk-upload';
}

export class AudioUploadService {
  async createUploadSession(userId: string, input: CreateUploadSessionInput) {
    if (input.sizeBytes <= 0 || input.sizeBytes > MAX_AUDIO_SIZE_BYTES) {
      throw new Error('Audio size is invalid or exceeds the maximum allowed size');
    }

    if (input.chunkSizeBytes <= 0 || input.chunkSizeBytes > MAX_CHUNK_SIZE_BYTES) {
      throw new Error('Chunk size is invalid');
    }

    const practiceSession = await PracticeSession.findOne({ _id: input.sessionId, userId }).select('_id');
    if (!practiceSession) {
      throw new Error('Practice session not found');
    }

    const uploadToken = crypto.randomBytes(16).toString('hex');
    const tempPrefix = `pronunciation/tmp/${userId}/${uploadToken}`;

    const uploadSession = await PronunciationUploadSession.create({
      userId,
      practiceSessionId: practiceSession._id,
      uploadToken,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      durationMs: input.durationMs,
      chunkSizeBytes: input.chunkSizeBytes,
      totalChunks: input.totalChunks,
      tempPrefix,
      waveformPeaks: input.waveformPeaks || [],
      qualityMetrics: input.qualityMetrics || {},
      deviceMetadata: input.deviceMetadata || {},
      networkMetadata: input.networkMetadata || {},
      validation: input.validation || {},
      lastActivityAt: new Date(),
    });

    const finalObjectKey = `pronunciation/audio/${userId}/${practiceSession._id}/${uploadSession._id}.webm`;
    let uploadUrl: string | null = null;
    let uploadMethod: CreateUploadSessionResult['uploadMethod'] = 'legacy-chunk-upload';

    if ((process.env.OBJECT_STORAGE_PROVIDER || process.env.CLOUD_STORAGE_PROVIDER) === 's3') {
      uploadUrl = await objectStorage.createPresignedUploadUrl(finalObjectKey, input.mimeType, 900);
      uploadMethod = 's3-presigned-put';
    }

    await PronunciationUploadSession.updateOne(
      { _id: uploadSession._id },
      {
        $set: {
          finalObjectKey,
          finalAudioUrl: null,
          status: 'initiated',
        },
      }
    );

    pronunciationMetrics.increment('uploads.started');

    const response = uploadSession.toObject();

    return {
      ...response,
      _id: response._id.toString(),
      userId: response.userId.toString(),
      practiceSessionId: response.practiceSessionId.toString(),
      uploadToken: response.uploadToken,
      fileName: response.fileName,
      mimeType: response.mimeType,
      sizeBytes: response.sizeBytes,
      durationMs: response.durationMs,
      chunkSizeBytes: response.chunkSizeBytes,
      totalChunks: response.totalChunks,
      uploadedParts: response.uploadedParts,
      uploadedBytes: response.uploadedBytes,
      status: response.status,
      tempPrefix: response.tempPrefix,
      finalObjectKey,
      finalAudioUrl: response.finalAudioUrl ?? null,
      uploadUrl,
      uploadMethod,
    } as CreateUploadSessionResult;
  }

  async getUploadSession(userId: string, uploadId: string) {
    return PronunciationUploadSession.findOne({ _id: uploadId, userId }).lean();
  }

  async uploadPart(userId: string, uploadId: string, partIndex: number, chunk: Express.Multer.File) {
    if (activeUploads >= MAX_CONCURRENT_UPLOADS) {
      if (chunk.path) await fs.unlink(chunk.path).catch(() => {});
      throw new Error('System is currently at maximum upload capacity. Please try again in a few seconds.');
    }
    
    activeUploads++;
    const startMemory = process.memoryUsage();
    const startMs = Date.now();

    try {
      const uploadSession = await this.requireActiveSession(userId, uploadId);

      if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= uploadSession.totalChunks) {
        throw new Error('Invalid part index');
      }

      const partKey = `${uploadSession.tempPrefix}/part-${partIndex.toString().padStart(5, '0')}.webm`;
      
      if (chunk.path) {
        await objectStorage.uploadFile({
          key: partKey,
          filePath: chunk.path,
          contentType: chunk.mimetype || uploadSession.mimeType,
          metadata: {
            uploadId: uploadSession._id.toString(),
            partIndex: String(partIndex),
          },
        });
      } else if (chunk.buffer) {
        await objectStorage.uploadBuffer({
          key: partKey,
          buffer: chunk.buffer,
          contentType: chunk.mimetype || uploadSession.mimeType,
          metadata: {
            uploadId: uploadSession._id.toString(),
            partIndex: String(partIndex),
          },
        });
      }

      const uploadedParts = Array.from(new Set([...(uploadSession.uploadedParts || []), partIndex])).sort((a, b) => a - b);
      const uploadedBytes = Math.min(
        uploadSession.sizeBytes,
        uploadedParts.length * uploadSession.chunkSizeBytes
      );

      await PronunciationUploadSession.updateOne(
        { _id: uploadSession._id },
        {
          $set: {
            uploadedParts,
            uploadedBytes,
            status: uploadedParts.length === uploadSession.totalChunks ? 'uploading' : 'uploading',
            lastActivityAt: new Date(),
          },
        }
      );

      return {
        uploadId,
        uploadedParts,
        uploadedBytes,
        totalChunks: uploadSession.totalChunks,
        completed: uploadedParts.length === uploadSession.totalChunks,
      };
    } finally {
      activeUploads--;
      if (chunk.path) await fs.unlink(chunk.path).catch(() => {});
      
      const endMemory = process.memoryUsage();
      
      // Local metrics
      pronunciationMetrics.observe('upload.memory.before.mb', Math.round(startMemory.rss / 1024 / 1024));
      pronunciationMetrics.observe('upload.memory.after.mb', Math.round(endMemory.rss / 1024 / 1024));
      pronunciationMetrics.observe('upload.duration.ms', Date.now() - startMs);
      pronunciationMetrics.increment('upload.size.bytes', chunk.size);

      // Publish to Redis for Admin Dashboard
      metricsPublisher.trackPronunciation(
        'upload',
        Date.now() - startMs,
        startMemory,
        endMemory,
        process.cpuUsage(),
        process.cpuUsage()
      );
    }
  }

  async completeUpload(userId: string, uploadId: string) {
    const uploadSession = await this.requireActiveSession(userId, uploadId);

    const isDirectUpload = Boolean(uploadSession.finalObjectKey && (process.env.OBJECT_STORAGE_PROVIDER || process.env.CLOUD_STORAGE_PROVIDER) === 's3');

    if (!isDirectUpload && (uploadSession.uploadedParts || []).length !== uploadSession.totalChunks) {
      throw new Error('Upload is incomplete');
    }

    const finalObjectKey = uploadSession.finalObjectKey || `pronunciation/audio/${userId}/${uploadSession.practiceSessionId}/${uploadSession._id}.webm`;
    let finalAudioUrl = uploadSession.finalAudioUrl || null;

    if (isDirectUpload) {
      const exists = await objectStorage.objectExists(finalObjectKey);
      if (!exists) {
        throw new Error('Uploaded audio not found in object storage');
      }
      finalAudioUrl = await objectStorage.getPublicUrl(finalObjectKey);
    } else {
      const partKeys = [...uploadSession.uploadedParts]
        .sort((a, b) => a - b)
        .map((partIndex) => `${uploadSession.tempPrefix}/part-${partIndex.toString().padStart(5, '0')}.webm`);

      const tempFilePath = path.join(os.tmpdir(), `${uploadSession._id}.webm`);
      const startMemory = process.memoryUsage();
      const startMs = Date.now();
      try {
        // Download and append parts sequentially
        for (const key of partKeys) {
          const partBuffer = await objectStorage.downloadBuffer(key);
          await fs.appendFile(tempFilePath, partBuffer);
        }

        const uploaded = await objectStorage.uploadFile({
          key: finalObjectKey,
          filePath: tempFilePath,
          contentType: uploadSession.mimeType,
          metadata: {
            uploadId: uploadSession._id.toString(),
            practiceSessionId: uploadSession.practiceSessionId.toString(),
          },
        });

        finalAudioUrl = uploaded.url;
        await objectStorage.deleteKeys(partKeys);
      } finally {
        await fs.unlink(tempFilePath).catch(() => {});
        const endMemory = process.memoryUsage();
        metricsPublisher.trackPronunciation(
          'assembly',
          Date.now() - startMs,
          startMemory,
          endMemory,
          process.cpuUsage(),
          process.cpuUsage()
        );
      }
    }

    await PronunciationUploadSession.updateOne(
      { _id: uploadSession._id },
      {
        $set: {
          status: 'assembled',
          finalObjectKey,
          finalAudioUrl,
          uploadedBytes: uploadSession.sizeBytes,
          lastActivityAt: new Date(),
        },
      }
    );

    pronunciationMetrics.increment('uploads.completed');

    return {
      uploadId,
      audioUrl: finalAudioUrl,
      objectKey: finalObjectKey,
      status: 'assembled',
    };
  }

  async cancelUpload(userId: string, uploadId: string) {
    const uploadSession = await PronunciationUploadSession.findOne({ _id: uploadId, userId });
    if (!uploadSession) {
      return null;
    }

    const keys = await objectStorage.listKeys(uploadSession.tempPrefix);
    await objectStorage.deleteKeys(keys);

    if (uploadSession.finalObjectKey) {
      await objectStorage.deleteKeys([uploadSession.finalObjectKey]);
    }

    uploadSession.status = 'cancelled';
    uploadSession.lastActivityAt = new Date();
    await uploadSession.save();

    return uploadSession.toObject();
  }

  private async requireActiveSession(userId: string, uploadId: string): Promise<IPronunciationUploadSession> {
    const uploadSession = await PronunciationUploadSession.findOne({ _id: uploadId, userId });
    if (!uploadSession) {
      throw new Error('Upload session not found');
    }

    if (['cancelled', 'failed', 'completed'].includes(uploadSession.status)) {
      throw new Error('Upload session is not active');
    }

    return uploadSession;
  }
}
