import spellingChecker from '../src/services/NLP/spellingChecker.js';
import vocabAnalyzer from '../src/services/NLP/vocabAnalyzer.js';

async function run() {
  const text = "This sentnce has multiple errorrs and teh is misspelled. It lacks commas and capitalization may be off";

  console.log('\n--- Spelling Report ---');
  try {
    const report = await spellingChecker.getReport(text);
    console.log('Spelling report:', report);
  } catch (err) {
    console.error('Spelling getReport failed:', err);
  }

  console.log('\n--- Vocabulary Analysis ---');
  try {
    const v = await vocabAnalyzer.analyze(text);
    console.log('Vocabulary analysis:', v);
  } catch (err) {
    console.error('Vocab analyze failed:', err);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
