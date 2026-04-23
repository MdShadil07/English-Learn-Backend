#!/usr/bin/env node
import { processAccuracyRequest } from '../src/services/Accuracy/accuracyProcessingService';

async function run() {
  const previousAccuracy = {
    overall: 90,
    grammar: 100,
    vocabulary: 100,
    spelling: 92,
    fluency: 45,
    calculationCount: 25,
  } as any;

  const params = {
    userMessage: "This sentnce definetely contain severel mispellings wich affect its overal quality.",
    aiResponse: '',
    userTier: 'free' as any,
    previousAccuracy,
  };

  const res = await processAccuracyRequest(params as any);
  console.log('\n=== RESULT ===');
  console.log('analysis.overall', res.analysis.overall);
  console.log('analysis.grammar', res.analysis.grammar);
  console.log('analysis.vocabulary', res.analysis.vocabulary);
  console.log('analysis.spelling', res.analysis.spelling);
  console.log('analysis.fluency', res.analysis.fluency);
  console.log('\ncurrentAccuracy', res.currentAccuracy);
  console.log('weightedAccuracy', res.weightedAccuracy);
}

run().catch(e => { console.error(e); process.exit(1); });