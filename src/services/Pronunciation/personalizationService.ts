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

  const profile = await SpeechProfile.findOneAndUpdate({ userId }, update, { upsert: true, new: true });
  return profile;
}

export async function getProfile(userId: string) {
  return SpeechProfile.findOne({ userId }).lean();
}

export default { updateProfileFromAttempt, getProfile };
