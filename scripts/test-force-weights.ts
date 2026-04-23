import { enhancedWeightedAccuracyService as svc } from '../src/utils/calculators/enhancedWeightedAccuracy.js';

(async function(){
  process.env.FORCE_HISTORICAL_WEIGHT = '0.35';
  const weights = (svc as any).calculateAdaptiveWeights(5, undefined, {overall:36},{overall:80});
  console.log('forced weights (messageCount 5):', weights);
  const weighted = (svc as any).applyWeightedCalculation({overall:36,grammar:20,fluency:25,vocabulary:36,spelling:93,punctuation:100,capitalization:100},{overall:80,grammar:75,vocabulary:70,spelling:80,fluency:72,punctuation:78,capitalization:80},weights);
  console.log('weighted overall (calc):', weighted.overall);
})().catch(e=>{ console.error(e); process.exit(1); });
