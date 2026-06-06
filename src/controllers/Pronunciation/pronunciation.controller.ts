import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { PronunciationService } from '../../services/Pronunciation/pronunciationService.js';
import { AudioUploadService } from '../../services/Pronunciation/audioUploadService.js';
import { toPronunciationAttemptResponse, toPronunciationUploadSessionResponse } from '../../services/Pronunciation/responseAdapters.js';
import { QueueBackpressureError } from '../../services/Pronunciation/queueAdmission.js';

interface AuthRequest extends Request {
  user?: any;
}

// Helper utility to execute database calls with automatic retries on connection loss/resets
async function withDbRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      return await fn();
    } catch (error: any) {
      attempts++;
      const isNetworkError = error?.name === 'MongoNetworkError' || 
                             error?.name === 'MongoNetworkTimeoutError' ||
                             error?.name === 'MongoServerError' ||
                             error?.message?.includes('ECONNRESET') || 
                             error?.message?.includes('connection') ||
                             error?.message?.includes('timeout') ||
                             error?.code === 'ECONNRESET';
      
      if (isNetworkError && attempts < maxAttempts) {
        console.warn(`⚠️ Mongoose network error (attempt ${attempts}/${maxAttempts}): ${error.message || error}. Retrying in 1.5s...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        // Wait if mongoose is currently disconnected/reconnecting
        if (mongoose.connection.readyState !== 1) {
          console.log('🔄 Mongoose connection state is not connected. Waiting for reconnection...');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        continue;
      }
      throw error;
    }
  }
  throw new Error('Database operation failed after max retry attempts');
}

export class PronunciationController {
  private readonly service = new PronunciationService();
  private readonly uploadService = new AudioUploadService();

  createSession = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const payload = req.body || {};
      const result = await withDbRetry(() => this.service.createPracticeSession(user._id, payload));

      return res.status(201).json({
        success: true,
        message: 'Solo practice session created successfully',
        data: result,
      });
    } catch (error: any) {
      console.error('Create pronunciation session error:', error);
      return res.status(500).json({ success: false, message: 'Failed to create solo practice session' });
    }
  };

  getSession = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { sessionId } = req.params;
      const session = await withDbRetry(() => this.service.getPracticeSession(user._id, sessionId));
      if (!session) {
        return res.status(404).json({ success: false, message: 'Practice session not found' });
      }

      return res.json({ success: true, data: session });
    } catch (error: any) {
      console.error('Get pronunciation session error:', error);
      return res.status(500).json({ success: false, message: 'Failed to load practice session' });
    }
  };

  submitAttempt = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { sessionId } = req.params;
      const { audioUrl, audioObjectKey, audioMimeType, uploadSessionId, transcript, attemptNumber, metadata } = req.body;

      if (!audioUrl) {
        return res.status(400).json({ success: false, message: 'audioUrl is required' });
      }

      const attempt = await withDbRetry(() => this.service.submitPracticeAttempt(user._id, sessionId, {
        audioUrl,
        audioObjectKey,
        audioMimeType,
        uploadSessionId,
        transcript: transcript || '',
        attemptNumber: attemptNumber || 1,
        metadata,
      }));

      return res.status(201).json({ success: true, data: toPronunciationAttemptResponse(attempt), message: 'Practice attempt submitted for analysis' });
    } catch (error: any) {
      console.error('Submit pronunciation attempt error:', error);
      if (error instanceof QueueBackpressureError || error?.code === 'QUEUE_BACKPRESSURE') {
        return res.status(error.statusCode || 429).json({
          success: false,
          message: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        });
      }
      return res.status(500).json({ success: false, message: 'Failed to submit practice attempt' });
    }
  };

  getAttempt = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { sessionId, attemptId } = req.params;
      const attempt = await withDbRetry(() => this.service.getAttempt(user._id, sessionId, attemptId));
      if (!attempt) {
        return res.status(404).json({ success: false, message: 'Practice attempt not found' });
      }

      return res.json({ success: true, data: toPronunciationAttemptResponse(attempt) });
    } catch (error: any) {
      console.error('Get pronunciation attempt error:', error);
      return res.status(500).json({ success: false, message: 'Failed to get attempt data' });
    }
  };

  recommendPassage = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const recommendation = await withDbRetry(() => this.service.recommendPassage(user._id, req.body || {}));
      return res.json({ success: true, data: recommendation });
    } catch (error: any) {
      console.error('Recommend pronunciation passage error:', error);
      return res.status(500).json({ success: false, message: 'Failed to recommend passage' });
    }
  };

  createUploadSession = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const uploadSession = await withDbRetry(() => this.uploadService.createUploadSession(user._id, req.body || {}));
      return res.status(201).json({ success: true, data: toPronunciationUploadSessionResponse(uploadSession), message: 'Upload session created' });
    } catch (error: any) {
      console.error('Create pronunciation upload session error:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to create upload session' });
    }
  };

  getUploadSession = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const uploadSession = await withDbRetry(() => this.uploadService.getUploadSession(user._id, req.params.uploadId));
      if (!uploadSession) {
        return res.status(404).json({ success: false, message: 'Upload session not found' });
      }

      return res.json({ success: true, data: toPronunciationUploadSessionResponse(uploadSession) });
    } catch (error: any) {
      console.error('Get pronunciation upload session error:', error);
      return res.status(500).json({ success: false, message: 'Failed to load upload session' });
    }
  };

  uploadChunk = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'chunk file is required' });
      }

      const partIndex = Number(req.body.partIndex);
      const result = await withDbRetry(() => this.uploadService.uploadPart(user._id, req.params.uploadId, partIndex, req.file!));
      return res.json({ success: true, data: result, message: 'Chunk uploaded successfully' });
    } catch (error: any) {
      console.error('Pronunciation upload chunk error:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to upload chunk' });
    }
  };

  completeUpload = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const result = await withDbRetry(() => this.uploadService.completeUpload(user._id, req.params.uploadId));
      return res.json({ success: true, data: result, message: 'Audio upload completed' });
    } catch (error: any) {
      console.error('Complete pronunciation upload error:', error);
      return res.status(400).json({ success: false, message: error.message || 'Failed to complete upload' });
    }
  };

  cancelUpload = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      await withDbRetry(() => this.uploadService.cancelUpload(user._id, req.params.uploadId));
      return res.json({ success: true, message: 'Upload cancelled successfully' });
    } catch (error: any) {
      console.error('Cancel pronunciation upload error:', error);
      return res.status(500).json({ success: false, message: 'Failed to cancel upload' });
    }
  };

  getPassageRecommendations = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const { cefrLevel } = req.body;
      const recommendation = await withDbRetry(() => this.service.recommendPassage(user._id, {
        cefrLevel: cefrLevel || user.cefrLevel,
      }));

      return res.json({ success: true, data: recommendation });
    } catch (error: any) {
      console.error('Get passage recommendations error:', error);
      return res.status(500).json({ success: false, message: 'Failed to get passage recommendations' });
    }
  };
}

export const pronunciationController = new PronunciationController();
