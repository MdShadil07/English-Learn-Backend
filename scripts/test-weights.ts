import enhancedService from '../src/utils/calculators/enhancedWeightedAccuracy.js';

async function run() {
  // Access private method via cast - runtime JS allows this
  const svc: any = enhancedService as any;

  const sampleCurrent = { overall: 60, grammar: 20, vocabulary: 36, spelling: 93, fluency: 25, punctuation: 50, capitalization: 50 };
  const samplePrevious = { overall: 75, grammar: 75, vocabulary: 70, spelling: 80, fluency: 72, punctuation: 78, capitalization: 80 };

  console.log('--- Test: messageCount = 0 (new user) ---');
  const w0 = svc.calculateAdaptiveWeights?.(0, undefined, sampleCurrent, samplePrevious);
  console.log('weights (msgCount=0):', w0);

  console.log('\n--- Test: messageCount = 15 (mid user) ---');
  const w15 = svc.calculateAdaptiveWeights?.(15, undefined, sampleCurrent, samplePrevious);
  console.log('weights (msgCount=15):', w15);

  console.log('\n--- Test: messageCount = 1 (second message) ---');
  const w1 = svc.calculateAdaptiveWeights?.(1, undefined, sampleCurrent, samplePrevious);
  console.log('weights (msgCount=1):', w1);

  // Also try running the public API but bypassing DB/redis by not awaiting updateHistoricalContext
  try {
    const res = await svc.calculateEnhancedWeightedAccuracy?.('000000000000000000000000', sampleCurrent);
    console.log('\n--- Public API (may attempt DB/redis) ---');
    console.log('returned weights:', res?.weights);
    console.log('returned weighted overall:', res?.weighted?.overall);
  } catch (err) {
    console.warn('Public API call failed (expected if DB/redis unavailable):', err?.message || err);
  }
}

run().catch((e) => {
  console.error('Test script error:', e);
  process.exit(1);
});
