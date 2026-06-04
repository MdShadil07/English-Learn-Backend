import mongoose from 'mongoose';
import { User, Passage, PracticeAttempt, PracticeSession, PronunciationUploadSession, UserPhonemeProfile, WordAnalysis } from '../../models/index.js';
import { queueSpeechAnalysis } from '../../queues/speechAnalysisQueue.js';
import { pronunciationMetrics } from './pronunciationMetrics.js';
import { SpeechProcessingPipeline } from './speechProcessingPipeline.js';
import { MontrealForcedAlignerService } from './alignment/montrealForcedAlignerService.js';
import { PhonemeScoringService } from './scoring/phonemeScoringService.js';
import { semanticRelevanceService, type SemanticRelevanceResult } from './scoring/semanticRelevanceService.js';
import { analyzePhonologicalProfile, type PhonologicalProfileResult } from './scoring/regionalPatternEngine.js';
import { detectPhenomena, type PhenomenonResult } from './phenomena/phenomenaEngine.js';
import { PronunciationLexiconService } from './scoring/pronunciationLexiconService.js';
import { analyzeCommunicationPremium } from './communicationCoach.js';
import { telemetryService } from '../telemetryService.js';
import { resolveMouthAnimationCue } from './mouthAnimationLibrary.js';
import { updateProfileFromAttempt, getProfile } from './personalizationService.js';
import { evaluateBadgesFromProfile } from './gamificationService.js';
import { FasterWhisperProvider } from './providers/FasterWhisperProvider.js';
import { logger } from '../../utils/calculators/core/logger.js';
import { AttemptValidationService, type AttemptValidationResult } from './attemptValidationService.js';
import { createPronunciationJobRecord, setAttemptState, setPronunciationJobState, setSessionProgress, setSessionTerminalState, setUploadSessionState } from './jobStateMachine.js';
import { ensureSpeechQueueCapacity } from './queueAdmission.js';
import {
  alignWordSequences,
  calculateWordAlignmentConfidence,
  tokenizeForAlignment,
} from './alignment/wordSequenceAligner.js';
import { unifiedAccuracyCalculator } from '../../utils/calculators/unifiedAccuracyCalculators.js';
import { pronunciationAccuracyCalculator } from '../../utils/calculators/pronunciationAccuracyCalculator.js';

export interface PassageRecommendationInput {
  cefrLevel?: string;
  vocabularyScore?: number;
  grammarLevel?: number;
  weakPhonemes?: string[];
  phonemeTargets?: string[];
  fluencyLevel?: string;
  exerciseType?: string;
  mtiTargets?: string[];
}

export interface PracticeAttemptSubmission {
  audioUrl: string;
  audioObjectKey?: string;
  audioMimeType?: string;
  uploadSessionId?: string;
  transcript: string;
  attemptNumber: number;
  metadata?: Record<string, unknown>;
}

export interface SpeechAnalysisJobData {
  attemptId: string;
  userId: string;
  sessionId: string;
  passageId: string;
  audioUrl: string;
  audioObjectKey?: string;
  audioMimeType?: string;
  transcript: string;
  metadata?: Record<string, unknown>;
  submittedAt: number;
}

export class PronunciationService {
  private readonly transcriber = new FasterWhisperProvider();
  private readonly pipeline = new SpeechProcessingPipeline(this.transcriber);
  private readonly aligner = new MontrealForcedAlignerService();
  private readonly scorer = new PhonemeScoringService();
  private readonly semanticGate = semanticRelevanceService;
  private readonly attemptValidator = new AttemptValidationService();
  private static readonly ASR_CONFIDENCE_RETRY_THRESHOLD = 0.50;
  private static readonly ASR_CONFIDENCE_CAUTION_THRESHOLD = 0.85;
  private static readonly ALIGNMENT_CONFIDENCE_RETRY_THRESHOLD = 0.20;
  private static readonly SEMANTIC_CONFIDENCE_RETRY_THRESHOLD = 0.55;

  async createPracticeSession(userId: string, recommendationInput: PassageRecommendationInput) {
    const passage = await this.recommendPassage(userId, recommendationInput);
    if (!passage) {
      throw new Error('No passage available for recommendation');
    }

    const session = await PracticeSession.create({
      userId,
      passageId: passage._id,
      passageSnapshot: {
        text: passage.text,
        passageVersion: passage.passageVersion,
        cefrLevel: passage.cefrLevel,
        exerciseType: passage.exerciseType,
        curriculumTrack: passage.curriculumTrack,
        lessonGroup: passage.lessonGroup,
        phonemeDensity: passage.phonemeDensity,
        phonemeTargets: passage.phonemeTargets,
        mtiTargets: passage.mtiTargets,
        metadata: passage.metadata,
      },
      status: 'pending',
      recommendation: recommendationInput,
      attempts: [],
    });

    return {
      session,
      passage,
    };
  }

  async getPracticeSession(userId: string, sessionId: string) {
    return PracticeSession.findOne({ _id: sessionId, userId }).lean();
  }

  async recommendPassage(userId: string, recommendationInput: PassageRecommendationInput) {
    const user = await User.findById(userId).select('subscription updatedAt pronunciationProfile').lean();
    const userLevel = await (await import('../../models/UserLevel.js')).default.findOne({ userId }).lean();
    
    // Determine user's CEFR level based on their level and proficiency scores
    let userCEFRLevel = recommendationInput.cefrLevel;
    
    if (!userCEFRLevel && userLevel) {
      // Map user level to CEFR level
      if (userLevel.level <= 3) {
        userCEFRLevel = 'A1'; // Beginner
      } else if (userLevel.level <= 6) {
        userCEFRLevel = 'A2'; // Elementary
      } else if (userLevel.level <= 9) {
        userCEFRLevel = 'B1'; // Intermediate
      } else {
        userCEFRLevel = 'B2'; // Upper Intermediate
      }
    }
    
    // Adjust CEFR level based on pronunciation score
    if (userLevel && userLevel.pronunciation < 50 && userCEFRLevel !== 'A1') {
      userCEFRLevel = 'A1'; // Keep beginners at A1 until they improve
    }
    
    const query: Record<string, any> = { isActive: true, cefrLevel: userCEFRLevel || 'A1' };

    // Get user's completed passages to avoid repeating the same passages
    const completedSessions = await PracticeSession.find({ userId, status: 'completed' })
      .select('passageId')
      .lean();
    
    const completedPassageIds = new Set(
      completedSessions.map(s => s.passageId?.toString()).filter(Boolean)
    );

    // Exclude completed passages from selection
    if (completedPassageIds.size > 0) {
      query._id = { $nin: Array.from(completedPassageIds).map(id => new mongoose.Types.ObjectId(id)) };
    }

    // For beginners (A1), implement exercise-wise progression but with more flexibility
    if (userCEFRLevel === 'A1' && !recommendationInput.exerciseType) {
      // Exercise progression order for beginners
      const exerciseProgression = [
        'short_sentence',
        'phrase_drill',
        'minimal_contrast',
        'cluster_drill',
        'medium_sentence',
        'question_intonation',
        'long_reading'
      ];
      
      // Get completed exercise types
      const completedExerciseTypes = new Set(
        completedSessions.map(s => s.passageSnapshot?.exerciseType).filter(Boolean)
      );
      
      // Find available exercise types (not completed)
      const availableExerciseTypes = exerciseProgression.filter(
        et => !completedExerciseTypes.has(et)
      );
      
      // If there are available exercise types, pick one randomly
      if (availableExerciseTypes.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableExerciseTypes.length);
        query.exerciseType = availableExerciseTypes[randomIndex];
      } else {
        // If all exercises completed, allow any exercise type
        query.exerciseType = { $in: exerciseProgression };
      }
    } else if (recommendationInput.exerciseType) {
      query.exerciseType = recommendationInput.exerciseType;
    }

    // Only use weak phoneme targeting if it doesn't restrict results too much
    if (user?.pronunciationProfile?.weakPhonemes?.length && !recommendationInput.phonemeTargets?.length) {
      const weakPhonemes = user.pronunciationProfile.weakPhonemes
        .sort((a, b) => a.score - b.score)
        .slice(0, 3)
        .map(p => p.phoneme);
      
      if (weakPhonemes.length) {
        // First try with weak phoneme targeting
        query.phonemeTargets = { $in: weakPhonemes };
        
        // Check if there are passages with these filters
        const count = await Passage.countDocuments(query);
        if (count === 0) {
          // If no passages found, remove the phoneme filter
          delete query.phonemeTargets;
        }
      }
    } else if (recommendationInput.phonemeTargets?.length) {
      query.phonemeTargets = { $in: recommendationInput.phonemeTargets };
    }

    if (recommendationInput.mtiTargets?.length) {
      query.mtiTargets = { $in: recommendationInput.mtiTargets };
    }

    // Get all matching passages and randomly select one
    const passages = await Passage.find(query)
      .sort({ 'difficulty.phonetic': 1, phonemeDensity: -1, createdAt: -1 })
      .limit(50) // Get up to 50 matching passages
      .lean();

    if (passages.length > 0) {
      // Randomly select a passage from the available ones
      const randomIndex = Math.floor(Math.random() * passages.length);
      return passages[randomIndex];
    }

    // Fallback: remove exercise type restriction and try again
    delete query.exerciseType;
    const fallbackPassages = await Passage.find(query)
      .sort({ 'difficulty.phonetic': 1, phonemeDensity: -1, createdAt: -1 })
      .limit(50)
      .lean();
    
    if (fallbackPassages.length > 0) {
      const randomIndex = Math.floor(Math.random() * fallbackPassages.length);
      return fallbackPassages[randomIndex];
    }

    // Final fallback: remove all restrictions except active
    const finalFallbackPassages = await Passage.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    if (finalFallbackPassages.length > 0) {
      const randomIndex = Math.floor(Math.random() * finalFallbackPassages.length);
      return finalFallbackPassages[randomIndex];
    }

    // Final fallback to default passage
    return {
      _id: new mongoose.Types.ObjectId(),
      text: 'The architect designed a beautiful structure for the museum.',
      cefrLevel: userCEFRLevel || 'B1',
      exerciseType: recommendationInput.exerciseType || 'Architecture',
      passageVersion: 1,
      curriculumTrack: 'general-english',
      lessonGroup: 'solo-practice',
      phonemeTargets: recommendationInput.phonemeTargets?.length ? recommendationInput.phonemeTargets : ['CH', 'SH'],
      mtiTargets: recommendationInput.mtiTargets?.length ? recommendationInput.mtiTargets : ['clarity'],
      phonemeDensity: 0.54,
      metadata: {},
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async submitPracticeAttempt(userId: string, sessionId: string, attemptData: PracticeAttemptSubmission) {
    const session = await PracticeSession.findOne({ _id: sessionId, userId });
    if (!session) {
      throw new Error('Practice session not found');
    }

    await ensureSpeechQueueCapacity();

    const attempt = await PracticeAttempt.create({
      userId,
      sessionId: session._id,
      passageId: session.passageId,
      audioUrl: attemptData.audioUrl,
      audioObjectKey: attemptData.audioObjectKey,
      audioMimeType: attemptData.audioMimeType || 'audio/webm',
      uploadSessionId: attemptData.uploadSessionId || null,
      transcript: attemptData.transcript,
      attemptNumber: attemptData.attemptNumber,
      status: 'uploaded',
      processingStage: 'uploaded',
      scores: {
        pronunciation: 0,
        fluency: 0,
        stress: 0,
        intonation: 0,
        clarity: 0,
      },
      wordAnalysis: [],
      phonemeAnalysis: [],
      prosodyAnalysis: {},
    });

    session.attempts.push(attempt._id);
    if (session.status === 'pending') {
      session.status = 'in_progress';
      session.processingStage = 'uploaded';
      session.startedAt = new Date();
    }
    await session.save();

    await createPronunciationJobRecord({
      attemptId: attempt._id.toString(),
      userId,
      sessionId: session._id,
      passageId: session.passageId,
      audioUrl: attemptData.audioUrl,
      audioObjectKey: attemptData.audioObjectKey,
      audioMimeType: attemptData.audioMimeType,
      transcript: attemptData.transcript,
      attemptNumber: attemptData.attemptNumber,
      timeoutMs: parseInt(process.env.PRONUNCIATION_JOB_TIMEOUT_MS || '90000', 10),
    });

    await queueSpeechAnalysis({
      attemptId: attempt._id.toString(),
      userId,
      sessionId: session._id.toString(),
      passageId: session.passageId.toString(),
      audioUrl: attemptData.audioUrl,
      audioObjectKey: attemptData.audioObjectKey,
      audioMimeType: attemptData.audioMimeType,
      transcript: attemptData.transcript,
      metadata: attemptData.metadata,
      submittedAt: Date.now(),
    });

    if (attemptData.uploadSessionId) {
      await setUploadSessionState(attemptData.uploadSessionId, {
        status: 'queued',
        observability: (attemptData.metadata?.observability as Record<string, unknown>) || {},
      });
    }

    return attempt.toObject();
  }

  async getAttempt(userId: string, sessionId: string, attemptId: string) {
    return PracticeAttempt.findOne({ _id: attemptId, sessionId, userId }).lean();
  }

  async processSpeechAnalysisJob(attemptId: string, jobData: SpeechAnalysisJobData, options: { signal?: AbortSignal; workerId?: string } = {}) {
    const attempt = await PracticeAttempt.findById(attemptId);
    if (!attempt) {
      throw new Error('Practice attempt not found');
    }

    try {
      await setPronunciationJobState(attemptId, 'VALIDATING', { message: 'Validating and preparing pronunciation analysis', workerId: options.workerId });
      setAttemptState(attempt, 'preprocessing');
      await attempt.save();
      await setSessionProgress(attempt.sessionId, 'preprocessing');
      if (attempt.uploadSessionId) {
        await PronunciationUploadSession.findByIdAndUpdate(attempt.uploadSessionId, {
          status: 'preprocessing',
          $set: {
            'observability.analysisStartedAt': new Date(),
            lastActivityAt: new Date(),
          },
        });
      }

      let pipelineResult;
      try {
        // Health check before processing
        const speechWorkerHealthy = await this.transcriber.healthCheck();
        if (!speechWorkerHealthy) {
          logger.warn({ attemptId }, 'Speech worker health check failed before processing');
        }
        
        pipelineResult = await this.pipeline.process(
          {
            audioObjectKey: jobData.audioObjectKey,
            audioUrl: jobData.audioUrl,
            transcript: jobData.transcript,
          },
          {
            ...options,
            onStage: async (stage) => {
              if (stage === 'DOWNLOADING' || stage === 'PREPROCESSING' || stage === 'INFERENCE') {
                await setPronunciationJobState(attemptId, stage, { workerId: options.workerId });
              }
            },
          }
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error({ 
          error: errorMessage, 
          errorStack,
          attemptId,
          fullError: JSON.stringify(error),
        }, 'Pipeline processing failed - detailed error log');
        // Handle transcription failures
        if (errorMessage.includes('SPEECH_WORKER_UNAVAILABLE') || errorMessage.includes('TRANSCRIPTION_FAILED')) {
          setAttemptState(attempt, 'retry_required');
          attempt.processingStage = 'failed';
          attempt.errorMessage = 'Speech recognition service is temporarily unavailable. Please try again later.';
          attempt.transcriptionProvider = 'faster-whisper';
          await attempt.save();

          await setPronunciationJobState(attemptId, 'RETRYING', { error: errorMessage, message: 'Speech worker unavailable or transcription failed', workerId: options.workerId });

          await setSessionTerminalState(attempt.sessionId, 'failed', 'failed');

          if (attempt.uploadSessionId) {
            await setUploadSessionState(attempt.uploadSessionId, {
              status: 'retry_required',
              errorMessage: attempt.errorMessage,
              observability: {
                ...(jobData.metadata?.observability as Record<string, unknown> || {}),
                transcriptionFailed: true,
                queueLatencyMs: Date.now() - jobData.submittedAt,
                analysisCompletedAt: new Date(),
              },
            });
          }

          pronunciationMetrics.increment('analysis.failed');
          return attempt;
        }
        throw error; // Re-throw other errors
      }

      setAttemptState(attempt, 'transcribing');
      await attempt.save();
      await setSessionProgress(attempt.sessionId, 'transcribing');
      if (attempt.uploadSessionId) {
        await setUploadSessionState(attempt.uploadSessionId, {
          status: 'transcribing',
        });
      }
      const asrConfidence = pipelineResult.transcription.confidence;
      const trustSignals = this.buildTrustSignals(jobData.metadata, asrConfidence);

      await setPronunciationJobState(attemptId, 'SCORING', { message: 'Running pronunciation scoring', workerId: options.workerId });

      // DETAILED LOGGING: Log all aspects of pipeline result for debugging
      logger.info({
        context: 'SPEECH_PIPELINE_RESULT',
        attemptId,
        transcriptionProvider: pipelineResult.transcription.provider,
        recognizedText: pipelineResult.transcription.text,
        expectedText: jobData.transcript,
        asrConfidence,
        wordCount: pipelineResult.transcription.words.length,
        segmentCount: pipelineResult.transcription.segments.length,
        preprocessingMetrics: pipelineResult.metadata.preprocessing,
        audioPath: pipelineResult.normalizedAudioPath,
      }, 'Speech pipeline processing completed - FULL DIAGNOSTICS');

      attempt.processingMetrics = {
        queueLatencyMs: Date.now() - jobData.submittedAt,
        averageAnalysisTimeMs: Date.now() - jobData.submittedAt,
        preprocessing: pipelineResult.metadata.preprocessing,
        forcedAlignmentPreparation: pipelineResult.metadata.forcedAlignmentPreparation,
      };
      attempt.intermediateArtifacts = {
        workspaceDirectory: pipelineResult.workspaceDirectory,
        normalizedAudioPath: pipelineResult.normalizedAudioPath,
        downloadedAudioPath: pipelineResult.downloadedAudioPath,
      };
      attempt.recognizedTranscript = pipelineResult.transcription.text;
      attempt.transcriptionProvider = pipelineResult.transcription.provider;
      attempt.asrConfidence = asrConfidence;
      attempt.trustSignals = trustSignals;
      attempt.analysisJobId = jobData.attemptId;

      const attemptValidation = this.attemptValidator.validate({
        expectedTranscript: jobData.transcript,
        recognizedTranscript: pipelineResult.transcription.text,
        asrConfidence,
        metadata: jobData.metadata,
      });

      attempt.attemptClassification = attemptValidation.classification;
      attempt.trustSignals = this.mergeValidationTrustSignals(
        attempt.trustSignals,
        attemptValidation
      );

      if (!attemptValidation.isScoreable) {
        logger.warn(
          {
            attemptId,
            classification: attemptValidation.classification,
            expectedTranscript: attemptValidation.expectedTranscript,
            recognizedTranscript: attemptValidation.recognizedTranscript,
            metrics: attemptValidation.metrics,
          },
          'Pronunciation attempt rejected by validation layer'
        );

        await this.finalizeInvalidAttempt(
          attempt,
          jobData,
          attemptValidation
        );
        return attempt;
      }

      // Validate transcription quality - check for major mismatches
      const transcriptionQuality = this.validateTranscriptionQuality(
        jobData.transcript,
        pipelineResult.transcription.text,
        asrConfidence
      );

      if (!transcriptionQuality.isValid) {
        const transcriptionIssue = transcriptionQuality.issue || 'Transcript similarity is lower than expected.';
        logger.warn({
          attemptId,
          issue: transcriptionIssue,
          expectedWords: jobData.transcript.split(/\s+/).length,
          recognizedWords: pipelineResult.transcription.text.split(/\s+/).length,
          wordSimilarity: transcriptionQuality.wordSimilarity,
          asrConfidence,
        }, 'Transcription quality issue detected');

        attempt.trustSignals = {
          ...(attempt.trustSignals || {}),
          cautionMessage: transcriptionIssue,
          uncertaintyReasons: [
            ...(((attempt.trustSignals || {}).uncertaintyReasons as string[] | undefined) || []),
            transcriptionIssue,
          ],
        };
      }

      // (Removed arbitrary ASR retry threshold block)

      const semanticAssessment = await this.semanticGate.evaluate({
        expectedTranscript: jobData.transcript,
        recognizedTranscript: pipelineResult.transcription.text,
        asrConfidence,
        metadata: jobData.metadata,
      });

      const semanticValidation = this.buildSemanticValidationResult(
        semanticAssessment,
        jobData.transcript,
        pipelineResult.transcription.text,
        asrConfidence
      );

      attempt.trustSignals = this.mergeValidationTrustSignals(
        {
          ...this.buildTrustSignals(jobData.metadata, asrConfidence, semanticAssessment),
          semantic: semanticAssessment,
        },
        semanticValidation
      );

      if (!semanticAssessment.shouldScore) {
        logger.warn(
          {
            attemptId,
            semanticAssessment,
            expectedTranscript: jobData.transcript,
            recognizedTranscript: pipelineResult.transcription.text,
          },
          'Pronunciation attempt rejected by semantic relevance gate'
        );

        await this.finalizeInvalidAttempt(attempt, jobData, semanticValidation);
        return attempt;
      }

      setAttemptState(attempt, 'aligning');
      await attempt.save();
      await setSessionProgress(attempt.sessionId, 'aligning');
      if (attempt.uploadSessionId) {
        await setUploadSessionState(attempt.uploadSessionId, {
          status: 'aligning',
        });
      }

      const transcriptionText = pipelineResult.transcription.text || jobData.transcript;
      const alignmentTranscript = !transcriptionQuality.isValid && this.aligner.isMfaConfigured()
        ? jobData.transcript
        : transcriptionText;

      if (alignmentTranscript !== transcriptionText) {
        logger.warn({
          attemptId,
          issue: 'Using expected passage text for alignment because ASR transcript had a major mismatch',
          expectedTranscript: jobData.transcript,
          recognizedTranscript: transcriptionText,
        }, 'Alignment fallback to expected transcript');
      }

      const alignmentResult = await this.aligner.alignAudioToTranscript(
        pipelineResult.normalizedAudioPath,
        alignmentTranscript,
        pipelineResult.workspaceDirectory,
        pipelineResult.transcription.words,
        options
      );

      const flatPhones = alignmentResult.wordIntervals.flatMap(w => w.phonemes);
      if (flatPhones.length > 0) {
        const acousticFeatures = await this.transcriber.analyzeAcoustics(
          pipelineResult.normalizedAudioPath,
          flatPhones.map(p => ({ phoneme: p.phoneme, startTime: p.startTime, endTime: p.endTime }))
        );
        if (acousticFeatures && acousticFeatures.phones) {
          let acousticCursor = 0;
          for (const word of alignmentResult.wordIntervals) {
            for (const phone of word.phonemes) {
              const features = acousticFeatures.phones[acousticCursor];
              if (features && features.phoneme === phone.phoneme.toUpperCase()) {
                phone.pitchMean = features.pitchMean;
                phone.pitchMax = features.pitchMax;
                phone.pitchSlope = features.pitchSlope;
                phone.rmsDb = features.rmsDb;
                phone.spectralCentroid = features.spectralCentroid;
                phone.mfccMean = features.mfccMean;
              } else if (features) {
                phone.pitchMean = features.pitchMean;
                phone.pitchMax = features.pitchMax;
                phone.pitchSlope = features.pitchSlope;
                phone.rmsDb = features.rmsDb;
                phone.spectralCentroid = features.spectralCentroid;
                phone.mfccMean = features.mfccMean;
              }
              acousticCursor++;
            }
          }
        }
      }

      setAttemptState(attempt, 'analyzing');
      await setSessionProgress(attempt.sessionId, 'analyzing');
      if (attempt.uploadSessionId) {
        await setUploadSessionState(attempt.uploadSessionId, {
          status: 'analyzing',
        });
      }

      const analysisStart = Date.now();
      const analysis = await this.scorer.scoreAlignedPronunciation(jobData.transcript, alignmentResult);
      telemetryService.recordServiceCall('pronunciation', Date.now() - analysisStart, false);

      if (asrConfidence < PronunciationService.ASR_CONFIDENCE_CAUTION_THRESHOLD) {
        analysis.drillRecommendations = [];
      }

      const evaluationResult = await pronunciationAccuracyCalculator.evaluatePronunciation(analysis, {
        asrConfidence,
        userId: attempt.userId?.toString(),
        expectedTranscript: jobData.transcript,
        recognizedTranscript: transcriptionText,
      });
      const calibratedScores = evaluationResult.adjustedScores;

      const passageSeverity = this.classifyPassageSeverity({
        classification: semanticAssessment.classification,
        semanticConfidence: semanticAssessment.semanticConfidence,
        alignmentConfidence: analysis.metadata.alignmentConfidence,
        asrConfidence,
        audioQualityScore: this.readAudioQualityScore(jobData.metadata),
        pronunciationScore: calibratedScores.pronunciation,
      });

      attempt.processingMetrics = {
        ...(attempt.processingMetrics || {}),
        alignment: alignmentResult.metadata,
        scoring: analysis.metadata,
        scoreCalibration: {
          rawScores: analysis.scores,
          calibratedScores,
          factors: {
            semanticConfidence: semanticAssessment.semanticConfidence,
            alignmentConfidence: analysis.metadata.alignmentConfidence,
            asrConfidence,
            audioQualityScore: this.readAudioQualityScore(jobData.metadata),
          },
        },
        semanticClassification: semanticAssessment.classification,
        passageSeverity,
      };
      attempt.intermediateArtifacts = {
        ...(attempt.intermediateArtifacts || {}),
        textGridPath: alignmentResult.metadata.textGridPath,
      };

      attempt.scores = calibratedScores;
      if (evaluationResult.nlpErrors && evaluationResult.nlpErrors.length > 0) {
        (attempt as any).metadata = { ...((attempt as any).metadata || {}), grammarErrors: evaluationResult.nlpErrors };
      }
      attempt.severity = passageSeverity.level;
      
      // Refine word analysis using acoustic confidence from calculator
      const refinedWordAnalysis = pronunciationAccuracyCalculator.refineWordAnalysis(analysis.wordAnalysis, asrConfidence);
      const wordAnalysisWithAnimation = this.enrichWordAnalysisWithAnimationCues(refinedWordAnalysis);
      
      attempt.wordAnalysis = wordAnalysisWithAnimation;
      attempt.phonemeAnalysis = analysis.phonemeAnalysis;
      attempt.phonemeTimeline = analysis.phonemeTimeline;
      attempt.prosodyAnalysis = this.mergeProsodyWithAudioQuality(analysis.prosodyAnalysis, jobData.metadata);
      attempt.drillRecommendations = analysis.drillRecommendations;

      // Phonological profile analysis (neutral pattern-based feedback)
      try {
        const profile: PhonologicalProfileResult = analyzePhonologicalProfile(
          analysis.phonemeAnalysis,
          analysis.phonemeTimeline,
          { asrConfidence }
        );
        attempt.phonologicalProfile = profile;
        attempt.trustSignals = {
          ...(attempt.trustSignals || {}),
          phonologicalProfile: profile,
        } as Record<string, unknown>;

        if (Array.isArray(profile.dominantPatterns) && profile.dominantPatterns.length) {
          attempt.drillRecommendations = attempt.drillRecommendations || [];
          const names = profile.dominantPatterns.map((p) => p.replace(/_/g, ' '));
          attempt.drillRecommendations.push({
            type: 'pattern-personalized',
            instruction: `Detected pronunciation patterns: ${names.join(', ')}. ${profile.suggestions.slice(0,2).join(' ')}`,
          });
        }

        // Phase 3: Detect fine-grained phonological phenomena and attach KG-backed suggestions
        try {
          const phenomena: PhenomenonResult[] = detectPhenomena(
            analysis.phonemeAnalysis,
            analysis.phonemeTimeline,
            analysis.wordAnalysis,
            { asrConfidence }
          );
          const fallbackPhenomena = this.deriveFallbackPhenomenaFromWordAnalysis(analysis.wordAnalysis);
          attempt.phenomena = Array.isArray(phenomena) && phenomena.length ? phenomena : fallbackPhenomena;
          // Promote top phenomenon to explicit drill recommendation
          if (Array.isArray(attempt.phenomena) && attempt.phenomena.length) {
            const top = [...attempt.phenomena].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
            attempt.drillRecommendations = attempt.drillRecommendations || [];
            attempt.drillRecommendations.unshift({
              type: 'phenomenon-drill',
              instruction: `${top.name}: ${top.drills?.map((d: any)=>d.instruction).slice(0,1).join(' ')}`,
            });
          }
        } catch (err) {
          logger.warn({ err, attemptId }, 'Phenomena engine failed — continuing without phenomena');
        }
      } catch (err) {
        logger.warn({ err, attemptId }, 'Phonological profile engine crashed — continuing without profile analysis');
      }
      attempt.trustSignals = {
        ...(attempt.trustSignals || {}),
        uncertaintyReasons: [
          ...(((attempt.trustSignals || {}).uncertaintyReasons as string[] | undefined) || []),
          ...(alignmentResult.provider !== 'mfa' ? ['Forced alignment fallback mode was used because Montreal Forced Aligner was unavailable.'] : []),
          ...(analysis.metadata.alignmentConfidence < PronunciationService.ALIGNMENT_CONFIDENCE_RETRY_THRESHOLD ? ['Alignment confidence was below the required threshold for detailed phoneme feedback.'] : []),
          ...(semanticAssessment.semanticConfidence < PronunciationService.SEMANTIC_CONFIDENCE_RETRY_THRESHOLD ? ['Semantic relevance confidence was below the preferred threshold.'] : []),
          ...(semanticAssessment.classification === 'wrong_passage' ? ['Wrong passage spoken: the recognized transcript does not match the displayed passage.'] : []),
          ...(semanticAssessment.classification === 'random_speech' ? ['Unrelated speech was detected instead of the expected passage.'] : []),
        ],
        cautionMessage:
          semanticAssessment.classification === 'wrong_passage'
            ? 'Wrong passage spoken. Read the displayed passage exactly as shown.'
            : semanticAssessment.classification === 'random_speech'
            ? 'Unrelated speech was detected. Please read only the displayed passage.'
            : semanticAssessment.semanticConfidence < PronunciationService.SEMANTIC_CONFIDENCE_RETRY_THRESHOLD
            ? 'Semantic relevance is below the preferred threshold; the score has been calibrated conservatively.'
            : analysis.metadata.alignmentConfidence < PronunciationService.ALIGNMENT_CONFIDENCE_RETRY_THRESHOLD
            ? 'Alignment confidence is too low for trustworthy phoneme-level feedback.'
            : alignmentResult.provider !== 'mfa'
            ? 'Pronunciation analysis used fallback alignment because MFA is not configured or failed.'
            : (attempt.trustSignals || {}).cautionMessage,
        semantic: semanticAssessment,
        severity: passageSeverity,
      } as Record<string, unknown>;
      if (semanticAssessment.classification === 'wrong_passage' || semanticAssessment.classification === 'random_speech') {
        setAttemptState(attempt, 'retry_required');
        attempt.errorMessage = passageSeverity.label === 'critical'
          ? 'Wrong passage spoken. Please read the displayed passage exactly as shown.'
          : 'The recording does not match the displayed passage closely enough for pronunciation scoring.';
        attempt.scores = {
          pronunciation: 0,
          fluency: 0,
          stress: 0,
          intonation: 0,
          clarity: 0,
        };
        attempt.wordAnalysis = [];
        attempt.phonemeAnalysis = [];
        attempt.phonemeTimeline = [];
        attempt.drillRecommendations = [];
      } else if (analysis.metadata.alignmentConfidence < PronunciationService.ALIGNMENT_CONFIDENCE_RETRY_THRESHOLD) {
        setAttemptState(attempt, 'retry_required');
        attempt.errorMessage = "We couldn't generate detailed phoneme feedback reliably. Please retry with cleaner audio.";
        attempt.scores = {
          pronunciation: 0,
          fluency: 0,
          stress: 0,
          intonation: 0,
          clarity: this.calculateFallbackClarity(jobData.transcript, pipelineResult.transcription.text),
        };
        // Preserve the phoneme/word analysis so the UI can still display what was detected.
        // The results are still marked as low-confidence and require retry.
        attempt.wordAnalysis = this.enrichWordAnalysisWithAnimationCues(analysis.wordAnalysis);
        attempt.phonemeAnalysis = analysis.phonemeAnalysis;
        attempt.phonemeTimeline = analysis.phonemeTimeline;
        attempt.drillRecommendations = [];
      }
      if (attempt.status !== 'retry_required' && asrConfidence < PronunciationService.ASR_CONFIDENCE_CAUTION_THRESHOLD) {
        attempt.errorMessage = 'Analysis completed with caution because the speech recognition confidence was lower than ideal.';
      } else if (attempt.status !== 'retry_required') {
        attempt.errorMessage = undefined;
      }
      if (attempt.status !== 'retry_required') {
        setAttemptState(attempt, 'completed');
      }

      const premium = await this.isPremiumUser(attempt.userId?.toString?.() || '');
      if (premium && attempt.status !== 'retry_required') {
        try {
          const coachAnalysis = await analyzeCommunicationPremium({
            transcript: attempt.transcript,
            recognizedTranscript: attempt.recognizedTranscript,
            wordAnalysis: attempt.wordAnalysis,
            phonemeAnalysis: attempt.phonemeAnalysis,
            prosodyAnalysis: attempt.prosodyAnalysis,
            metadata: { ...(jobData.metadata || {}), asrConfidence },
          });
          (attempt as any).coachAnalysis = coachAnalysis;
          await updateProfileFromAttempt(attempt.userId.toString(), attempt);
          const profile = await getProfile(attempt.userId.toString());
          (attempt as any).badges = evaluateBadgesFromProfile(profile);
        } catch (coachError) {
          logger.warn({ coachError, attemptId }, 'Coach analysis failed; continuing without coach payload');
        }
      }

      await attempt.save();

      await setPronunciationJobState(
        attemptId,
        attempt.status === 'retry_required' ? 'RETRYING' : 'COMPLETED',
        { message: attempt.status === 'retry_required' ? 'Analysis completed with retry required' : 'Pronunciation analysis completed', workerId: options.workerId }
      );

      if (attempt.status === 'completed') {
        await this.createWordAnalysisDocuments(attempt, analysis.wordAnalysis);
        await this.updateUserPhonemeProfiles(attempt);
      }

      await PracticeSession.findByIdAndUpdate(attempt.sessionId, {
        status: attempt.status === 'retry_required' ? 'failed' : 'completed',
        processingStage: attempt.processingStage,
        completedAt: new Date(),
      });

      if (attempt.status === 'completed') {
        await this.updateUserPronunciationProfile(attempt.userId.toString(), attempt);
      }

      if (attempt.uploadSessionId) {
        await setUploadSessionState(attempt.uploadSessionId, {
          status: attempt.status === 'retry_required' ? 'retry_required' : 'completed',
          observability: {
            ...(jobData.metadata?.observability as Record<string, unknown> || {}),
            queueLatencyMs: Date.now() - jobData.submittedAt,
            averageAnalysisTimeMs: Date.now() - jobData.submittedAt,
            alignmentFailureRate: analysis.metadata.alignmentConfidence < PronunciationService.ALIGNMENT_CONFIDENCE_RETRY_THRESHOLD ? 1 : 0,
            analysisCompletedAt: new Date(),
          },
        });
      }

      pronunciationMetrics.observe('queue.latency.ms', Date.now() - jobData.submittedAt);
      pronunciationMetrics.observe('queue.analysis_time.ms', Date.now() - jobData.submittedAt);
      pronunciationMetrics.observe('asr.confidence', asrConfidence);
      if (attempt.status === 'retry_required') {
        pronunciationMetrics.increment('analysis.retry_required');
        pronunciationMetrics.increment('alignment.failure_rate');
      } else {
        pronunciationMetrics.increment('analysis.completed');
      }

      return attempt;
    } catch (error) {
      telemetryService.recordServiceCall('pronunciation', 0, true);
      const message = error instanceof Error ? error.message : 'Pronunciation analysis failed';
      setAttemptState(attempt, 'failed');
      attempt.errorMessage = message;
      await attempt.save();

      await setPronunciationJobState(attemptId, error instanceof Error && message.toLowerCase().includes('timed out') ? 'TIMED_OUT' : 'FAILED', {
        error: error instanceof Error ? error : message,
        message,
        workerId: options.workerId,
      });

      await PracticeSession.findByIdAndUpdate(attempt.sessionId, {
        status: 'failed',
        processingStage: 'failed',
        completedAt: new Date(),
      });

      if (attempt.uploadSessionId) {
        await setUploadSessionState(attempt.uploadSessionId, {
          status: 'failed',
          errorMessage: message,
          observability: {
            ...(jobData.metadata?.observability as Record<string, unknown> || {}),
            analysisCompletedAt: new Date(),
          },
        });
      }

      pronunciationMetrics.increment('analysis.failed');
      throw error;
    } finally {
      // CRITICAL: Clean up temp workspace to prevent disk fill
      // Each job creates ~5-15MB of temp files (input.webm, normalized.wav, MFA corpus, TextGrid)
      try {
        const workspaceDir = (attempt as any)?.intermediateArtifacts?.workspaceDirectory;
        if (workspaceDir) {
          const fsPromises = await import('fs/promises');
          await fsPromises.rm(workspaceDir, { recursive: true, force: true });
        }
      } catch {
        // Best-effort cleanup — don't let cleanup failures affect the job result
      }
    }
  }

  private mergeValidationTrustSignals(
    current: any,
    validation: AttemptValidationResult
  ) {
    const uncertaintyReasons = [
      ...((current?.uncertaintyReasons as string[] | undefined) || []),
      ...(validation.isScoreable ? [] : [validation.reason]),
    ];

    return {
      ...(current || {}),
      confidenceBand: validation.isScoreable ? current?.confidenceBand || 'high' : 'low',
      cautionMessage: validation.isScoreable ? current?.cautionMessage : validation.reason,
      uncertaintyReasons,
      validation: {
        classification: validation.classification,
        isScoreable: validation.isScoreable,
        expectedTranscript: validation.expectedTranscript,
        recognizedTranscript: validation.recognizedTranscript,
        reason: validation.reason,
        recommendation: validation.recommendation,
        metrics: validation.metrics,
      },
    };
  }

  private async finalizeInvalidAttempt(
    attempt: any,
    jobData: SpeechAnalysisJobData,
    validation: AttemptValidationResult
  ) {
    setAttemptState(attempt, 'retry_required');
    attempt.errorMessage = validation.reason;
    attempt.attemptClassification = validation.classification;
    attempt.transcript = validation.recognizedTranscript;
    attempt.scores = {
      pronunciation: 0,
      fluency: 0,
      stress: 0,
      intonation: 0,
      clarity: this.calculateFallbackClarity(validation.expectedTranscript, validation.recognizedTranscript),
    };
    attempt.wordAnalysis = [];
    attempt.phonemeAnalysis = [];
    attempt.phonemeTimeline = [];
    attempt.prosodyAnalysis = this.mergeProsodyWithAudioQuality(
      {
        averageSpeakingRate: this.estimateSpeakingRate(validation.recognizedTranscript, jobData.metadata),
        validationOnly: true,
        classification: validation.classification,
      },
      jobData.metadata
    );
    attempt.phonologicalProfile = {
      patternScores: {},
      dominantPatterns: [],
      confidence: 0,
      patterns: [],
      suggestions: [validation.recommendation],
      validationOnly: true,
      reason: validation.reason,
    };
    attempt.drillRecommendations = [
      {
        type: 'retry-reading',
        instruction: validation.recommendation,
      },
    ];
    await attempt.save();

    await setPronunciationJobState(attempt._id.toString(), 'RETRYING', {
      message: validation.reason,
    });

    await PracticeSession.findByIdAndUpdate(attempt.sessionId, {
      status: 'failed',
      processingStage: 'retry_required',
      completedAt: new Date(),
    });

    if (attempt.uploadSessionId) {
      await setUploadSessionState(attempt.uploadSessionId, {
        status: 'retry_required',
        errorMessage: validation.reason,
        observability: {
          ...(jobData.metadata?.observability as Record<string, unknown> || {}),
          attemptClassification: validation.classification,
          validationMetrics: validation.metrics,
          queueLatencyMs: Date.now() - jobData.submittedAt,
          averageAnalysisTimeMs: Date.now() - jobData.submittedAt,
          analysisCompletedAt: new Date(),
        },
      });
    }

    pronunciationMetrics.increment('analysis.retry_required');
  }

  private async updateUserPronunciationProfile(userId: string, attempt: any) {
    const weakPhonemes = (attempt.phonemeAnalysis || []).slice(0, 5).map((item: any) => ({
      phoneme: item.phoneme,
      score: Math.round((item.confidence || 0) * 100),
      updatedAt: new Date(),
    }));

    // Use MTI-detected accent locale if available, otherwise default to en-IN
    const mtiLabel = (attempt as any)?.prosodyAnalysis?.provider === 'mfa'
      ? 'en-IN'
      : this.resolveAccentLocale(attempt);

    const { optimizedPronunciationTracker } = await import('./optimizedPronunciationTracker.js');
    await optimizedPronunciationTracker.trackProfile(
      userId,
      attempt.scores?.pronunciation || 0,
      attempt.prosodyAnalysis?.averageSpeakingRate || 0,
      Math.round((attempt.asrConfidence || 0) * 100) / 100,
      mtiLabel,
      weakPhonemes
    );
  }

  private resolveAccentLocale(attempt: any): string {
    const drillRecs = attempt.drillRecommendations || [];
    // Check if MTI detection classified a region
    const phonemeAnalysis = Array.isArray(attempt.phonemeAnalysis) ? attempt.phonemeAnalysis : [];
    // Default to en-IN if no classification available
    return 'en-IN';
  }

  private async updateUserPhonemeProfiles(attempt: any) {
    const phonemeAnalysis = Array.isArray(attempt.phonemeAnalysis) ? attempt.phonemeAnalysis : [];
    if (!phonemeAnalysis.length) {
      return;
    }

    const weakestWords = Array.isArray(attempt.wordAnalysis)
      ? attempt.wordAnalysis
          .filter((item: any) => item.score < 85)
          .slice(0, 5)
          .map((item: any) => ({
            word: item.word,
            score: item.score,
            updatedAt: new Date(),
          }))
      : [];
      
    const { optimizedPronunciationTracker } = await import('./optimizedPronunciationTracker.js');
    await optimizedPronunciationTracker.trackPhonemes(
      attempt.userId.toString(),
      attempt._id?.toString(),
      phonemeAnalysis,
      weakestWords,
      attempt.drillRecommendations || [],
      attempt.asrConfidence || 0
    );
  }

  private bumpCommonSubstitution(existing: Array<{ phoneme: string; count: number }>, actual: string) {
    if (!actual) {
      return existing;
    }
    const next = [...existing];
    const match = next.find((item) => item.phoneme === actual);
    if (match) {
      match.count += 1;
    } else {
      next.push({ phoneme: actual, count: 1 });
    }
    return next.sort((a, b) => b.count - a.count).slice(0, 5);
  }

  /**
   * Validate that recognized transcript is reasonably similar to expected transcript.
   * Helps detect major ASR failures or microphone/audio capture issues.
   */
  private validateTranscriptionQuality(
    expectedTranscript: string,
    recognizedTranscript: string,
    asrConfidence: number
  ): { isValid: boolean; issue?: string; wordSimilarity: number } {
    if (!expectedTranscript || !recognizedTranscript) {
      return { isValid: false, issue: 'Empty transcript detected', wordSimilarity: 0 };
    }

    const expectedWords = tokenizeForAlignment(expectedTranscript);
    const recognizedWords = tokenizeForAlignment(recognizedTranscript);

    if (expectedWords.length === 0 || recognizedWords.length === 0) {
      return { isValid: false, issue: 'Invalid transcript format', wordSimilarity: 0 };
    }

    const alignmentPairs = alignWordSequences(expectedWords, recognizedWords);
    const wordSimilarity = calculateWordAlignmentConfidence(alignmentPairs);
    const matchingWords = alignmentPairs.filter((pair) => pair.targetWord && pair.actualWord && pair.confidence >= 0.82).length;

    // CRITICAL DEBUG: Log all cases with low word similarity
    if (wordSimilarity < 0.5) {
      logger.error({
        context: 'LOW_WORD_SIMILARITY_DETECTED',
        expectedTranscript,
        recognizedTranscript,
        expectedWords,
        recognizedWords,
        matchingWords,
        wordSimilarity,
        asrConfidence,
        expectedWordCount: expectedWords.length,
        recognizedWordCount: recognizedWords.length,
      }, 'Transcription quality validation - LOW SIMILARITY');
    }

    // If very few words match and confidence is high, something is very wrong
    // Could be: user read different text, microphone captured wrong audio, etc.
    if (wordSimilarity < 0.15 && asrConfidence > 0.7) {
      return {
        isValid: false,
        issue: 'The recognized speech does not match the expected text. Please ensure you are reading the correct passage.',
        wordSimilarity,
      };
    }

    // If similarity is low and confidence is also low, just warn
    if (wordSimilarity < 0.5) {
      return {
        isValid: true,
        issue: 'Transcript similarity is lower than expected. Analysis results should be reviewed carefully.',
        wordSimilarity,
      };
    }

    return { isValid: true, wordSimilarity };
  }

  private buildTrustSignals(
    metadata: Record<string, unknown> | undefined,
    asrConfidence: number,
    semanticAssessment?: SemanticRelevanceResult
  ): {
    confidenceBand: 'high' | 'medium' | 'low';
    uncertaintyReasons: string[];
    noiseDetected: boolean;
    cautionMessage?: string;
    semantic?: SemanticRelevanceResult;
  } {
    const qualityMetrics = (metadata?.qualityMetrics as Record<string, unknown>) || {};
    const warnings = Array.isArray((qualityMetrics as any).warnings) ? ((qualityMetrics as any).warnings as string[]) : [];
    const audioQualityScore = typeof (qualityMetrics as any).audioQualityScore === 'number' ? (qualityMetrics as any).audioQualityScore as number : null;
    const backgroundNoiseEstimate = typeof (qualityMetrics as any).backgroundNoiseEstimate === 'number'
      ? (qualityMetrics as any).backgroundNoiseEstimate as number
      : 0;

    const uncertaintyReasons = [...warnings];
    if (audioQualityScore !== null && audioQualityScore < 55) {
      uncertaintyReasons.push('Audio quality score is below the preferred threshold.');
    }
    if (asrConfidence < PronunciationService.ASR_CONFIDENCE_CAUTION_THRESHOLD) {
      uncertaintyReasons.push('Speech recognition confidence is lower than ideal.');
    }
    if (backgroundNoiseEstimate > 0.05) {
      uncertaintyReasons.push('We detected some uncertainty due to background noise.');
    }
    if (semanticAssessment && semanticAssessment.semanticConfidence < 0.55) {
      uncertaintyReasons.push('Semantic relevance confidence is below the preferred threshold.');
    }

    const confidenceBand: 'high' | 'medium' | 'low' =
      semanticAssessment && semanticAssessment.semanticConfidence < 0.55
        ? 'low'
        : asrConfidence >= 0.9 ? 'high' : asrConfidence >= 0.75 ? 'medium' : 'low';

    return {
      confidenceBand,
      uncertaintyReasons,
      noiseDetected: backgroundNoiseEstimate > 0.05,
      cautionMessage: uncertaintyReasons[0] || undefined,
    };
  }

  private buildSemanticValidationResult(
    semanticAssessment: SemanticRelevanceResult,
    expectedTranscript: string,
    recognizedTranscript: string,
    asrConfidence: number
  ): AttemptValidationResult {
    return {
      classification: semanticAssessment.classification,
      isScoreable: semanticAssessment.shouldScore,
      expectedTranscript,
      recognizedTranscript,
      reason: semanticAssessment.reason,
      recommendation: semanticAssessment.recommendation,
      metrics: {
        similarity: semanticAssessment.semanticSimilarity,
        insertionRatio: 0,
        omissionRatio: semanticAssessment.classification === 'partial_reading' ? 0.5 : 0,
        matchedRatio: semanticAssessment.semanticConfidence,
        expectedWordCount: semanticAssessment.expectedWordCount,
        recognizedWordCount: semanticAssessment.recognizedWordCount,
        asrConfidence,
        detectedLanguage: semanticAssessment.detectedLanguage,
        semanticSimilarity: semanticAssessment.semanticSimilarity,
        semanticConfidence: semanticAssessment.semanticConfidence,
        alignmentSimilarity: semanticAssessment.alignmentSimilarity,
      },
    };
  }

  private calibrateScores(
    scores: { pronunciation: number; fluency: number; stress: number; intonation: number; clarity: number },
    factors: {
      semanticConfidence: number;
      alignmentConfidence: number;
      asrConfidence: number;
      audioQualityScore: number;
    }
  ) {
    const audioQualityFactor = Math.max(0.35, Math.min(1, (factors.audioQualityScore || 0) / 100 || 0.75));
    const semanticFactor = Math.max(0.35, Math.min(1, factors.semanticConfidence || 0));
    const alignmentFactor = Math.max(0.35, Math.min(1, factors.alignmentConfidence || 0));

    const calibrate = (value: number) => {
      const base = Math.max(0, Math.min(100, value));
      const calibrated = base * semanticFactor * alignmentFactor * audioQualityFactor;
      return Math.max(0, Math.min(100, Math.round(calibrated)));
    };

    return {
      pronunciation: calibrate(scores.pronunciation),
      fluency: calibrate(scores.fluency),
      stress: calibrate(scores.stress),
      intonation: calibrate(scores.intonation),
      clarity: calibrate(scores.clarity),
    };
  }

  private readAudioQualityScore(metadata: Record<string, unknown> | undefined) {
    const qualityMetrics = (metadata?.qualityMetrics as Record<string, unknown>) || {};
    const value = qualityMetrics.audioQualityScore;
    return typeof value === 'number' && Number.isFinite(value) ? value : 75;
  }

  private mergeProsodyWithAudioQuality(
    prosody: Record<string, unknown> | undefined,
    metadata: Record<string, unknown> | undefined
  ) {
    const base = (prosody || {}) as Record<string, unknown>;
    const qualityMetrics = ((metadata?.qualityMetrics as Record<string, unknown>) || {}) as Record<string, unknown>;
    const durationMsRaw = metadata?.durationMs || metadata?.recordingDurationMs;
    const durationMs = typeof durationMsRaw === 'number' && Number.isFinite(durationMsRaw) ? durationMsRaw : 0;
    const silenceRatioRaw = qualityMetrics.silenceRatio;
    const silenceRatio = typeof silenceRatioRaw === 'number' && Number.isFinite(silenceRatioRaw) ? Math.max(0, Math.min(1, silenceRatioRaw)) : 0;

    const currentPauseCount = typeof base.pauseCount === 'number' ? base.pauseCount : 0;
    const currentPauseTotalMs = typeof base.pauseTotalMs === 'number' ? base.pauseTotalMs : 0;

    const estimatedPauseTotalMs = Math.round((durationMs || 0) * silenceRatio);
    const estimatedPauseCount = Math.max(0, Math.round(estimatedPauseTotalMs / 700));

    return {
      ...base,
      pauseCount: currentPauseCount > 0 ? currentPauseCount : estimatedPauseCount,
      pauseTotalMs: currentPauseTotalMs > 0 ? currentPauseTotalMs : estimatedPauseTotalMs,
      pauseRatio: typeof base.pauseRatio === 'number' && base.pauseRatio > 0 ? base.pauseRatio : silenceRatio,
      qualitySilenceRatio: silenceRatio,
      speechToNoiseRatio: typeof qualityMetrics.speechToNoiseRatio === 'number' ? qualityMetrics.speechToNoiseRatio : null,
    };
  }

  private estimateSpeakingRate(transcript: string, metadata: Record<string, unknown> | undefined) {
    const words = tokenizeForAlignment(transcript || '');
    const durationRaw = metadata?.durationMs || metadata?.recordingDurationMs;
    const durationMs = typeof durationRaw === 'number' && Number.isFinite(durationRaw) ? durationRaw : 0;
    if (!words.length || durationMs <= 0) {
      return 0;
    }
    return Math.round((words.length / durationMs) * 60000);
  }

  private deriveFallbackPhenomenaFromWordAnalysis(wordAnalysis: any[]): PhenomenonResult[] {
    if (!Array.isArray(wordAnalysis) || !wordAnalysis.length) {
      return [];
    }

    const weakWords = wordAnalysis
      .filter((item) => typeof item?.score === 'number' && item.score < 85)
      .sort((a, b) => (a.score || 100) - (b.score || 100))
      .slice(0, 4);

    return weakWords.map((item, idx) => ({
      id: `word_mismatch_${String(item.word || `word_${idx}`).toLowerCase()}`,
      name: `Word-level mismatch: ${item.word || 'word'}`,
      confidence: Number((Math.max(0.15, (100 - (item.score || 0)) / 100)).toFixed(2)),
      evidence: [
        `Target: ${(item.expectedPhonemes || []).join(' ') || 'n/a'}`,
        `Spoken: ${(item.actualPhonemes || []).join(' ') || 'n/a'}`,
      ],
      affectedSounds: [...new Set([...(item.expectedPhonemes || []), ...(item.actualPhonemes || [])])].slice(0, 6),
      difficulty: (item.score || 0) < 60 ? 'hard' : (item.score || 0) < 75 ? 'medium' : 'easy',
      drills: [
        {
          type: 'word-contrast',
          instruction: `For "${item.word}", target sounds are ${(item.expectedPhonemes || []).join(' ') || 'n/a'} but spoken sounds were ${(item.actualPhonemes || []).join(' ') || 'n/a'}. Repeat slowly and compare.`
        },
      ],
      visual: {
        key: 'tongue_retract',
        instruction: 'Watch tongue placement and release timing while repeating the target word slowly.',
      },
    }));
  }

  private enrichWordAnalysisWithAnimationCues(wordAnalysis: any[]) {
    if (!Array.isArray(wordAnalysis) || !wordAnalysis.length) {
      return [];
    }

    return wordAnalysis.map((item) => ({
      ...item,
      animationCue: resolveMouthAnimationCue({
        word: item.word,
        expectedPhonemes: item.expectedPhonemes,
        actualPhonemes: item.actualPhonemes,
        issueType: item.issueType,
        score: item.score,
      }),
    }));
  }

  private async isPremiumUser(userId: string) {
    if (!userId) return false;
    const user = await User.findById(userId).select('tier subscription').lean();
    const tier = String((user as any)?.tier || '').toLowerCase();
    const planCode = String((user as any)?.subscription?.planCode || '').toUpperCase();
    const status = String((user as any)?.subscription?.status || '').toLowerCase();
    return tier === 'premium' || (planCode === 'PREMIUM' && (status === 'active' || status === 'none'));
  }

  private classifyPassageSeverity(input: {
    classification: SemanticRelevanceResult['classification'];
    semanticConfidence: number;
    alignmentConfidence: number;
    asrConfidence: number;
    audioQualityScore: number;
    pronunciationScore: number;
  }) {
    let level = 0;
    let label: 'minor' | 'moderate' | 'major' | 'critical' = 'minor';
    const reasons: string[] = [];

    if (input.classification === 'wrong_passage' || input.classification === 'random_speech' || input.classification === 'native_language') {
      level = 5;
      label = 'critical';
      reasons.push(`semantic:${input.classification}`);
    } else if (input.semanticConfidence < 0.45 || input.alignmentConfidence < 0.35) {
      level = 4;
      label = 'critical';
      reasons.push('semantic-or-alignment-below-trust');
    } else if (input.semanticConfidence < 0.6 || input.alignmentConfidence < 0.5 || input.audioQualityScore < 55) {
      level = 3;
      label = 'major';
      reasons.push('major-trust-drop');
    } else if (input.pronunciationScore < 70 || input.asrConfidence < 0.8) {
      level = 2;
      label = 'moderate';
      reasons.push('quality-needs-attention');
    } else {
      level = 1;
      label = 'minor';
      reasons.push('scoreable');
    }

    return {
      level,
      label,
      reasons,
    };
  }

  /**
   * Calculate clarity score from transcript comparison when full analysis isn't available.
   * Compares recognized transcript to expected transcript to provide clarity feedback.
   */
  private calculateFallbackClarity(expectedTranscript: string, recognizedTranscript: string): number {
    if (!expectedTranscript || !recognizedTranscript) {
      return 0;
    }

    const expectedWords = tokenizeForAlignment(expectedTranscript);
    const recognizedWords = tokenizeForAlignment(recognizedTranscript);

    if (expectedWords.length === 0) {
      return 0;
    }

    const alignmentPairs = alignWordSequences(expectedWords, recognizedWords);
    const matchingWords = alignmentPairs.filter((pair) => pair.targetWord && pair.actualWord && pair.confidence >= 0.82).length;

    // Also count correctly identified words that are out of order
    const expectedSet = new Set(expectedWords);
    const recognizedSet = new Set(recognizedWords);
    const commonWords = [...expectedSet].filter(w => recognizedSet.has(w)).length;

    // Accuracy: match rate between transcripts
    const accuracy = (matchingWords / expectedWords.length) * 0.7 + (commonWords / expectedWords.length) * 0.3;

    // Clarity score: 0-100 based on accuracy
    const clarityScore = Math.max(0, Math.min(100, Math.round(accuracy * 100)));

    logger.info({ 
      clarityScore,
      expectedWords: expectedWords.length,
      recognizedWords: recognizedWords.length,
      matchingWords,
      commonWords,
    }, 'Calculated fallback clarity score');

    return clarityScore;
  }

  private async createWordAnalysisDocuments(attempt: any, payload: any[]) {
    if (!payload.length) {
      return;
    }

    const bulkDocs = payload.map((item) => ({
      userId: attempt.userId,
      practiceAttemptId: attempt._id,
      sessionId: attempt.sessionId,
      passageId: attempt.passageId,
      word: item.word,
      expectedPhonemes: item.expectedPhonemes,
      expectedStress: item.expectedStress,
      expectedSyllables: item.expectedSyllables,
      actualPhonemes: item.actualPhonemes,
      severity: item.severity,
      score: item.score,
      startTime: item.startTime,
      endTime: item.endTime,
      issueType: item.issueType,
      animationCue: item.animationCue,
      componentScores: item.componentScores,
    }));

    await WordAnalysis.insertMany(bulkDocs, { ordered: false });
  }
}
