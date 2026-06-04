import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import PracticeAttempt from './src/models/PracticeAttempt.js';

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/english-practice');
    console.log('Connected to DB');
    
    // Find the latest attempt
    const latestAttempt = await PracticeAttempt.findOne().sort({ createdAt: -1 });
    
    if (latestAttempt) {
      console.log('--- LATEST ATTEMPT ---');
      console.log(`ID: ${latestAttempt._id}`);
      console.log(`Status: ${latestAttempt.status}`);
      console.log(`Processing Stage: ${latestAttempt.processingStage}`);
      console.log(`Classification: ${latestAttempt.attemptClassification}`);
      console.log(`Transcript: ${latestAttempt.transcript}`);
      console.log(`Recognized: ${latestAttempt.recognizedTranscript}`);
      console.log(`Scores: ${JSON.stringify(latestAttempt.scores)}`);
    } else {
      console.log('No attempts found');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
