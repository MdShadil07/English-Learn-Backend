#!/usr/bin/env node
import path from 'path';
import { analyzeMessage } from '../src/utils/calculators/unifiedAccuracyCalculators';

async function run() {
  const samples = [
    "I go to school yesterday and I learned alot.",
    "what wrong with this sentence",
    "He don't like the book and she doesnt too.",
    "The cat sit on the mat. teh dog sleep.",
    "I has a dream to become a engineer",
    "She were going to the market, but she forget her bag.",
    "This sentnce has multiple errorrs and typos, include teh and recieve and definately.",
  ];

  for (const s of samples) {
    try {
      console.log('\n=== SAMPLE ===');
      console.log(s);
      const res = await analyzeMessage(s, '', { enableNLP: true, enableWeightedCalculation: false });

      console.log('NLPCONTRIBUTIONS.languageTool:');
      console.dir(res.nlpContributions?.languageTool, { depth: 3 });

      console.log('NLPCONTRIBUTIONS.spelling.mergedDetails:');
      console.dir((res.nlpContributions as any)?.spelling?.mergedDetails, { depth: 3 });

      console.log('categoryDetails.grammar:', res.categoryDetails?.grammar);
      console.log('categoryDetails.spelling:', res.categoryDetails?.spelling);
      console.log('final grammar score:', res.grammar, 'spelling score:', res.spelling);
    } catch (err) {
      console.error('ERROR running sample:', err);
    }
  }
}

run().catch((e) => {
  console.error('Fatal error running diagnostics:', e);
  process.exit(1);
});
