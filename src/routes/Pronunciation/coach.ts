import { Router } from 'express';
import { authenticate } from '../../middleware/auth/auth.js';
import { analyzeCommunicationPremium } from '../../services/Pronunciation/communicationCoach.js';
import { updateProfileFromAttempt, getProfile } from '../../services/Pronunciation/personalizationService.js';
import { evaluateBadgesFromProfile } from '../../services/Pronunciation/gamificationService.js';

const router = Router();

function isPremiumUser(user: any) {
  const tier = String(user?.tier || '').toLowerCase();
  const planCode = String(user?.subscription?.planCode || '').toUpperCase();
  const subscriptionStatus = String(user?.subscription?.status || '').toLowerCase();
  return tier === 'premium' || (planCode === 'PREMIUM' && (subscriptionStatus === 'active' || subscriptionStatus === 'none'));
}

router.post('/coach/analyze', authenticate, async (req, res): Promise<void> => {
  try {
    const attempt = req.body.attempt;
    const userId = req.user && req.user._id;
    const premium = isPremiumUser(req.user);
    if (!premium) {
      res.status(403).json({
        success: false,
        code: 'PREMIUM_REQUIRED',
        message: 'Communication Coach AI is available for Premium users.',
      });
      return;
    }

    const analysis = await analyzeCommunicationPremium(attempt || {});
    // update long-term profile asynchronously
    if (userId) await updateProfileFromAttempt(userId.toString(), attempt || {});
    const profile = userId ? await getProfile(userId.toString()) : null;
    const badges = evaluateBadgesFromProfile(profile);
    res.json({ success: true, data: { analysis, profile, badges } });
    return;
  } catch (err) {
    console.error('Coach analyze error', err);
    res.status(500).json({ success: false, message: 'Coach analyze failed' });
    return;
  }
});

router.get('/profile', authenticate, async (req, res): Promise<void> => {
  const userId = req.user && req.user._id;
  if (!userId) {
    res.status(400).json({ success: false, message: 'Missing user' });
    return;
  }
  const profile = await getProfile(userId.toString());
  const badges = evaluateBadgesFromProfile(profile);
  res.json({ success: true, data: { profile, badges } });
  return;
});

export default router;
