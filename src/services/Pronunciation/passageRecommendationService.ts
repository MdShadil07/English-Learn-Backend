import { Passage, PracticeAttempt, UserLevel } from '../../models/index.js';
import type { IPassage, IUserLevel } from '../../models/index.js';

type UserLevelMetrics = Pick<IUserLevel, 'accuracy' | 'vocabulary' | 'grammar' | 'pronunciation' | 'fluency'> | null | undefined;

type LeanPassage = Pick<
  IPassage,
  '_id' | 'cefrLevel' | 'exerciseType' | 'isActive' | 'difficulty' | 'createdAt' | 'updatedAt'
>;

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const EXERCISE_SEQUENCE = ['short_sentence', 'phrase_drill', 'minimal_contrast', 'reading_passage', 'story_reading'];

type CefrLevel = typeof CEFR_LEVELS[number];
type ProficiencyLabel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' | 'Master';

interface UserProficiencySnapshot {
  level: number;
  proficiencyLabel: ProficiencyLabel;
  cefrLevel: CefrLevel;
  proficiencyScore: number;
  isBeginner: boolean;
}

export interface NextPassageResult {
  autoAdvance: boolean;
  score: number;
  threshold: number;
  nextPassage?: IPassage | null;
  availablePassages?: IPassage[];
  message: string;
}

const getProficiencyLabel = (level: number): ProficiencyLabel => {
  if (level >= 201) return 'Master';
  if (level >= 101) return 'Expert';
  if (level >= 51) return 'Advanced';
  if (level >= 21) return 'Intermediate';
  return 'Beginner';
};

const getCefrFromScore = (score: number): CefrLevel => {
  if (score >= 90) return 'C2';
  if (score >= 80) return 'C1';
  if (score >= 70) return 'B2';
  if (score >= 55) return 'B1';
  if (score >= 40) return 'A2';
  return 'A1';
};

const calculateProficiencyScore = (userLevel?: UserLevelMetrics): number => {
  if (!userLevel) return 0;
  const values = [
    userLevel.accuracy,
    userLevel.vocabulary,
    userLevel.grammar,
    userLevel.pronunciation,
    userLevel.fluency,
  ].filter((value) => typeof value === 'number');
  if (!values.length) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
};

const normalizeCompletedIds = (ids: string[] = []) =>
  ids.map((id) => id.toString());

class PassageRecommendationService {
  private readonly autoAdvanceThreshold = 70;

  private async getUserSnapshot(userId: string): Promise<UserProficiencySnapshot> {
    const userLevel = await UserLevel.findOne({ userId }).lean();
    const level = userLevel?.level ?? 1;
    const proficiencyScore = calculateProficiencyScore(userLevel);
    const proficiencyLabel = getProficiencyLabel(level);
    const cefrLevel = getCefrFromScore(proficiencyScore);
    return {
      level,
      proficiencyLabel,
      cefrLevel,
      proficiencyScore,
      isBeginner: proficiencyLabel === 'Beginner',
    };
  }

  private async getCompletedPassageIds(userId: string): Promise<string[]> {
    const attempts = await PracticeAttempt.find({ userId, status: 'completed' })
      .select('passageId')
      .lean();
    return attempts.map((attempt) => attempt.passageId.toString());
  }

  private async getNextBeginnerPassage(currentPassage: LeanPassage | null, completedIds: string[]): Promise<IPassage | null> {
    const completedSet = new Set(completedIds);
    const currentType = currentPassage?.exerciseType;
    const startIndex = currentType ? EXERCISE_SEQUENCE.indexOf(currentType) + 1 : 0;
    const exerciseCandidates = startIndex > 0 ? EXERCISE_SEQUENCE.slice(startIndex) : EXERCISE_SEQUENCE;

    for (const exerciseType of exerciseCandidates) {
      const passage = await Passage.findOne({
        cefrLevel: 'A1',
        exerciseType,
        isActive: true,
        _id: { $nin: Array.from(completedSet) },
      }).lean();
      if (passage) {
        return passage as unknown as IPassage;
      }
    }

    const nextLevelPassage = await Passage.findOne({
      cefrLevel: 'A2',
      isActive: true,
      _id: { $nin: Array.from(completedSet) },
    }).lean();
    return nextLevelPassage as unknown as IPassage | null;
  }

  private async getNextLevelPassage(
    currentPassage: LeanPassage | null,
    cefrLevel: CefrLevel,
    completedIds: string[]
  ): Promise<IPassage | null> {
    const completedSet = new Set(completedIds);
    const baseLevel = currentPassage?.cefrLevel || cefrLevel;
    const baseIndex = CEFR_LEVELS.indexOf(baseLevel as CefrLevel);

    const currentLevelPassage = await Passage.findOne({
      cefrLevel: baseLevel,
      isActive: true,
      _id: { $nin: Array.from(completedSet) },
    }).lean();
    if (currentLevelPassage) {
      return currentLevelPassage as unknown as IPassage;
    }

    if (baseIndex >= 0 && baseIndex < CEFR_LEVELS.length - 1) {
      const nextLevel = CEFR_LEVELS[baseIndex + 1];
      const nextPassage = await Passage.findOne({
        cefrLevel: nextLevel,
        isActive: true,
        _id: { $nin: Array.from(completedSet) },
      }).lean();
      if (nextPassage) {
        return nextPassage as unknown as IPassage;
      }
    }

    return null;
  }

  async getRecommendedPassageForUser(userId: string): Promise<IPassage | null> {
    const snapshot = await this.getUserSnapshot(userId);
    const completedIds = await this.getCompletedPassageIds(userId);

    if (snapshot.isBeginner) {
      return this.getNextBeginnerPassage(null, completedIds);
    }

    return this.getNextLevelPassage(null, snapshot.cefrLevel, completedIds);
  }

  async getRecommendationsForUser(userId: string, completedPassageIds: string[] = []): Promise<IPassage[]> {
    const snapshot = await this.getUserSnapshot(userId);
    const completedIds = normalizeCompletedIds(completedPassageIds);

    if (snapshot.isBeginner) {
      const recommendations: IPassage[] = [];
      for (const exerciseType of EXERCISE_SEQUENCE) {
        const passage = await Passage.findOne({
          cefrLevel: 'A1',
          exerciseType,
          isActive: true,
          _id: { $nin: completedIds },
        }).lean();
        if (passage) {
          recommendations.push(passage as unknown as IPassage);
        }
      }
      return recommendations;
    }

    const passages = await Passage.find({
      cefrLevel: snapshot.cefrLevel,
      isActive: true,
      _id: { $nin: completedIds },
    })
      .sort({ 'difficulty.phonetic': 1, createdAt: -1 })
      .limit(6)
      .lean();
    return passages as unknown as IPassage[];
  }

  async getNextPassageForUser(
    userId: string,
    currentPassageId: string,
    score: number,
    completedPassageIds: string[] = []
  ): Promise<NextPassageResult> {
    const snapshot = await this.getUserSnapshot(userId);
    const completedIds = normalizeCompletedIds(completedPassageIds);
    if (currentPassageId) {
      completedIds.push(currentPassageId.toString());
    }

    if (score >= this.autoAdvanceThreshold) {
      const currentPassage = currentPassageId ? await Passage.findById(currentPassageId).lean() : null;
      const nextPassage = snapshot.isBeginner
        ? await this.getNextBeginnerPassage(currentPassage as LeanPassage | null, completedIds)
        : await this.getNextLevelPassage(currentPassage as LeanPassage | null, snapshot.cefrLevel, completedIds);

      return {
        autoAdvance: true,
        score,
        threshold: this.autoAdvanceThreshold,
        nextPassage,
        message: nextPassage
          ? 'Great score! Moving to the next passage.'
          : 'Great score! No further passages available right now.',
      };
    }

    const availablePassages = await this.getRecommendationsForUser(userId, completedIds);
    return {
      autoAdvance: false,
      score,
      threshold: this.autoAdvanceThreshold,
      availablePassages,
      message: 'You can retry or select another passage to continue practicing.',
    };
  }
}

export const passageRecommendationService = new PassageRecommendationService();
