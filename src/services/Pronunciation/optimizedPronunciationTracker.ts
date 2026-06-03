import { redisCache } from '../../config/redis.js';
import User from '../../models/User.js';
import UserPhonemeProfile from '../../models/UserPhonemeProfile.js';
import mongoose from 'mongoose';

const CACHE_PREFIX_PROFILE = 'pronunciation:profile:';
const CACHE_PREFIX_PHONEMES = 'pronunciation:phonemes:';
const CACHE_PREFIX_ACTIVE_USERS = 'pronunciation:active_users';

interface PhonemeBufferData {
  totalScore: number;
  attempts: number;
  substitutions: Record<string, number>;
  weakestWords: Array<{ word: string; score: number; updatedAt: Date }>;
  lastAttemptId?: string;
}

interface ProfileBufferData {
  totalPronunciationScore: number;
  totalWpm: number;
  totalAsrConfidence: number;
  attempts: number;
  accentLocale?: string;
  weakPhonemes: Array<{ phoneme: string; score: number; updatedAt: Date }>;
}

export class OptimizedPronunciationTracker {
  
  /**
   * Track phoneme updates in Redis
   */
  async trackPhonemes(
    userId: string, 
    attemptId: string | undefined, 
    phonemeAnalysis: any[], 
    weakestWordsFromAttempt: any[],
    drillRecommendations: any[],
    asrConfidence: number
  ) {
    if (!redisCache || !redisCache.isConnected()) {
      return;
    }

    try {
      const client = redisCache.getClient();
      const phonemeKey = `${CACHE_PREFIX_PHONEMES}${userId}`;
      
      // We will do a multi/exec pipeline to avoid too many roundtrips
      const pipeline = client.multi();

      for (const item of phonemeAnalysis) {
        const phoneme = String(item.phoneme || '').toUpperCase();
        if (!phoneme) continue;

        const phonemeScore = Math.round((item.confidence || 0) * 100);
        const actual = String(item.actual || '').toUpperCase();
        
        // We will store delta values for simplicity, but since weakestWords is complex,
        // we'll just read existing, modify, and write back in the pipeline.
        // Actually, to avoid a read-modify-write race condition inside a loop,
        // we can fetch all phonemes for the user first, modify them in memory, and set them back.
        // But pipeline makes it faster. Let's just fetch them first.
      }

      // Alternative: fetch all fields of the Hash first
      const existingData = await client.hgetall(phonemeKey);
      
      for (const item of phonemeAnalysis) {
        const phoneme = String(item.phoneme || '').toUpperCase();
        if (!phoneme) continue;

        const phonemeScore = Math.round((item.confidence || 0) * 100);
        const actual = String(item.actual || '').toUpperCase();
        
        let data: PhonemeBufferData;
        if (existingData[phoneme]) {
          data = JSON.parse(existingData[phoneme]);
        } else {
          data = {
            totalScore: 0,
            attempts: 0,
            substitutions: {},
            weakestWords: [],
          };
        }

        data.totalScore += phonemeScore;
        data.attempts += 1;
        
        if (actual && actual !== phoneme) {
          data.substitutions[actual] = (data.substitutions[actual] || 0) + 1;
        }

        // Merge weakest words (keep top 5)
        const relevantWeakWords = weakestWordsFromAttempt.filter(w => {
           // We might not know which phoneme belongs to which word exactly here, 
           // but the original logic passed the attempt's weakest words to all phonemes.
           return true;
        });
        
        const combinedWordsMap = new Map<string, {word: string, score: number, updatedAt: Date}>();
        for (const w of [...data.weakestWords, ...relevantWeakWords]) {
          if (!combinedWordsMap.has(w.word) || combinedWordsMap.get(w.word)!.score > w.score) {
            combinedWordsMap.set(w.word, w);
          }
        }
        data.weakestWords = Array.from(combinedWordsMap.values())
                               .sort((a, b) => a.score - b.score)
                               .slice(0, 5);

        data.lastAttemptId = attemptId;

        pipeline.hset(phonemeKey, phoneme, JSON.stringify(data));
      }

      pipeline.sadd(CACHE_PREFIX_ACTIVE_USERS, userId);
      // Expire buffers after 24 hours just in case
      pipeline.expire(phonemeKey, 86400); 
      await pipeline.exec();

    } catch (error) {
      console.error('❌ Error tracking phonemes in Redis:', error);
    }
  }

  /**
   * Track profile updates in Redis
   */
  async trackProfile(
    userId: string, 
    pronunciationScore: number, 
    wpm: number, 
    asrConfidence: number,
    accentLocale: string,
    weakPhonemes: any[]
  ) {
    if (!redisCache || !redisCache.isConnected()) {
      return;
    }

    try {
      const client = redisCache.getClient();
      const profileKey = `${CACHE_PREFIX_PROFILE}${userId}`;

      const existingDataStr = await client.get(profileKey);
      let data: ProfileBufferData;
      
      if (existingDataStr) {
        data = JSON.parse(existingDataStr);
      } else {
        data = {
          totalPronunciationScore: 0,
          totalWpm: 0,
          totalAsrConfidence: 0,
          attempts: 0,
          weakPhonemes: []
        };
      }

      data.totalPronunciationScore += pronunciationScore;
      data.totalWpm += wpm;
      data.totalAsrConfidence += asrConfidence;
      data.attempts += 1;
      data.accentLocale = accentLocale;
      data.weakPhonemes = weakPhonemes;

      const pipeline = client.multi();
      pipeline.set(profileKey, JSON.stringify(data), 'EX', 86400);
      pipeline.sadd(CACHE_PREFIX_ACTIVE_USERS, userId);
      await pipeline.exec();

    } catch (error) {
      console.error('❌ Error tracking pronunciation profile in Redis:', error);
    }
  }

  /**
   * Flush all buffered data for a single user to MongoDB
   */
  async flushUserUpdates(userId: string) {
    if (!redisCache || !redisCache.isConnected()) {
      return;
    }

    const client = redisCache.getClient();
    const profileKey = `${CACHE_PREFIX_PROFILE}${userId}`;
    const phonemeKey = `${CACHE_PREFIX_PHONEMES}${userId}`;

    try {
      const [profileDataStr, phonemesData] = await Promise.all([
        client.get(profileKey),
        client.hgetall(phonemeKey)
      ]);

      if (!profileDataStr && Object.keys(phonemesData).length === 0) {
        await client.srem(CACHE_PREFIX_ACTIVE_USERS, userId);
        return;
      }

      // 1. Process Profile Update
      if (profileDataStr) {
        const profileBuffer: ProfileBufferData = JSON.parse(profileDataStr);
        if (profileBuffer.attempts > 0) {
          const avgScore = profileBuffer.totalPronunciationScore / profileBuffer.attempts;
          const avgWpm = profileBuffer.totalWpm / profileBuffer.attempts;
          const avgAsr = profileBuffer.totalAsrConfidence / profileBuffer.attempts;

          await User.updateOne(
            { _id: new mongoose.Types.ObjectId(userId) },
            {
              $set: {
                'pronunciationProfile.accentLocale': profileBuffer.accentLocale,
                'pronunciationProfile.weakPhonemes': profileBuffer.weakPhonemes,
                'pronunciationProfile.speechProfile.averagePronunciationScore': avgScore,
                'pronunciationProfile.speechProfile.averageWordsPerMinute': avgWpm,
                'pronunciationProfile.speechProfile.averageAsrConfidence': Math.round(avgAsr * 100) / 100,
                'pronunciationProfile.speechProfile.lastProcessedAt': new Date(),
              },
            }
          );
        }
      }

      // 2. Process Phoneme Updates
      const phonemeKeys = Object.keys(phonemesData);
      if (phonemeKeys.length > 0) {
        // Fetch existing documents from MongoDB to calculate running averages correctly
        const existingProfiles = await UserPhonemeProfile.find({
          userId: new mongoose.Types.ObjectId(userId),
          phoneme: { $in: phonemeKeys }
        }).lean();

        const existingMap = new Map(existingProfiles.map(p => [p.phoneme, p]));
        const bulkOps = [];

        for (const phoneme of phonemeKeys) {
          const buffer: PhonemeBufferData = JSON.parse(phonemesData[phoneme]);
          const existing = existingMap.get(phoneme);
          
          const prevAttempts = existing?.attempts || 0;
          const prevAvg = existing?.averageScore || 0;
          
          const nextAttempts = prevAttempts + buffer.attempts;
          const nextAverageScore = Math.round(
            ((prevAvg * prevAttempts) + buffer.totalScore) / nextAttempts
          );

          // Merge substitutions
          const subMap = new Map<string, number>();
          (existing?.commonSubstitutions || []).forEach(s => subMap.set(s.phoneme, s.count));
          for (const [sub, count] of Object.entries(buffer.substitutions)) {
            subMap.set(sub, (subMap.get(sub) || 0) + count);
          }
          const commonSubstitutions = Array.from(subMap.entries())
            .map(([p, c]) => ({ phoneme: p, count: c }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          const lastAttemptId = buffer.lastAttemptId ? new mongoose.Types.ObjectId(buffer.lastAttemptId) : existing?.lastAttemptId;

          // Build bulk operation
          bulkOps.push({
            updateOne: {
              filter: { userId: new mongoose.Types.ObjectId(userId), phoneme },
              update: {
                $set: {
                  averageScore: nextAverageScore,
                  commonSubstitutions,
                  weakestWords: buffer.weakestWords,
                  lastAttemptId,
                  lastUpdatedAt: new Date(),
                },
                $inc: {
                  attempts: buffer.attempts,
                },
                $push: {
                  improvementTrend: {
                    $each: [{ recordedAt: new Date(), score: Math.round(buffer.totalScore / buffer.attempts) }],
                    $slice: -30,
                  },
                },
              },
              upsert: true,
            }
          });
        }

        if (bulkOps.length > 0) {
          await UserPhonemeProfile.bulkWrite(bulkOps, { ordered: false });
        }
      }

      // Clear the buffers
      const pipeline = client.multi();
      pipeline.del(profileKey);
      pipeline.del(phonemeKey);
      pipeline.srem(CACHE_PREFIX_ACTIVE_USERS, userId);
      await pipeline.exec();

    } catch (error) {
      console.error(`❌ Error flushing pronunciation updates for user ${userId}:`, error);
    }
  }

  /**
   * Flush all active users' pronunciation data
   */
  async flushAllActiveUsers() {
    if (!redisCache || !redisCache.isConnected()) {
      return;
    }
    try {
      const client = redisCache.getClient();
      const activeUsers = await client.smembers(CACHE_PREFIX_ACTIVE_USERS);
      
      if (activeUsers.length === 0) return;
      
      console.log(`🔄 Flushing pronunciation updates for ${activeUsers.length} users...`);
      
      // Process in batches of 50 to avoid memory spikes
      for (let i = 0; i < activeUsers.length; i += 50) {
        const batch = activeUsers.slice(i, i + 50);
        await Promise.all(batch.map((userId: string) => this.flushUserUpdates(userId)));
      }
      
      console.log(`✅ Completed pronunciation flush`);
    } catch (error) {
      console.error('❌ Error flushing all active pronunciation users:', error);
    }
  }
}

export const optimizedPronunciationTracker = new OptimizedPronunciationTracker();
export default optimizedPronunciationTracker;
