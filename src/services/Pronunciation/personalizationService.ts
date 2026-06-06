import SpeechProfile from '../../models/SpeechProfile.js';

export async function updateProfileFromAttempt(userId: string, attempt: any) {
  if (!userId) return null;
  const transcript = (attempt.recognizedTranscript || '').toLowerCase();
  const fillers = (transcript.match(/\b(um+|uh+|erm|ah+|like|you know)\b/g) || []).length;
  const phenomena = (attempt.phenomena || []).map((p:any)=>p.id || p.name);

  const update: any = { $inc: { fillerCount: fillers } };
  if (phenomena.length) {
    phenomena.forEach((ph:any) => { update.$inc[`recurringPhenomena.${ph}`] = 1; });
  }

  if (attempt.phonemeAnalysis) {
    const weak = (attempt.phonemeAnalysis || []).filter((w:any)=>w.score && w.score < 0.6).map((w:any)=>w.targetPhoneme).filter(Boolean);
    if (weak.length) update.$addToSet = { weakPhonemes: { $each: weak } };
  }

  // Fetch current profile to calculate EMA for historical scoring
  const currentProfile = await SpeechProfile.findOne({ userId });
  const prevOverall = currentProfile?.overallScore || 0;
  const calcCount = currentProfile?.calculationCount || 0;
  
  const currentPronunciationScore = attempt.scores?.pronunciation || 0;
  
  // Historical Smoothing Logic (EMA)
  let smoothedScore = currentPronunciationScore;
  if (calcCount > 0) {
    // Dynamic weights based on experience
    const experienceAdjustment = Math.min(0.18, calcCount * 0.015);
    let currentWeight = Math.max(0.4, 0.65 - experienceAdjustment);
    
    // For very poor attempts, we give more weight to the current snapshot so history doesn't mask it
    if (currentPronunciationScore < 50) {
      currentWeight = Math.max(currentWeight, 0.65);
    }
    
    // For the first few messages, lean heavier on current
    if (calcCount < 3) {
      currentWeight = 0.8;
    }
    
    const historicalWeight = 1 - currentWeight;
    smoothedScore = Math.round((currentWeight * currentPronunciationScore) + (historicalWeight * prevOverall));
  }
  
  update.$set = { overallScore: smoothedScore };
  update.$inc.calculationCount = 1;
  update.$push = { scoreHistory: { at: new Date(), score: smoothedScore } };

  const profile = await SpeechProfile.findOneAndUpdate({ userId }, update, { upsert: true, new: true });
  return profile;
}

export async function getProfile(userId: string) {
  return SpeechProfile.findOne({ userId }).lean();
}

export default { updateProfileFromAttempt, getProfile };
