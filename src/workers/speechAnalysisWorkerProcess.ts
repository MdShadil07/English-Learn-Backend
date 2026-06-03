import dotenv from 'dotenv';
import { database } from '../config/database.js';
import { createSpeechAnalysisWorker, shutdownSpeechAnalysisWorker } from './speechAnalysisWorker.js';

dotenv.config();

async function bootstrap() {
  try {
    await database.connect();

    const worker = await createSpeechAnalysisWorker();
    if (!worker) {
      throw new Error('Speech analysis worker failed to start');
    }

    console.log('🎙️ Standalone speech analysis worker process started');
  } catch (error) {
    console.error('❌ Failed to start standalone speech analysis worker', error);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  console.log(`🛑 Received ${signal}. Shutting down speech worker...`);

  try {
    await shutdownSpeechAnalysisWorker();
    await database.disconnect();
  } catch (error) {
    console.error('❌ Error during speech worker shutdown', error);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap();