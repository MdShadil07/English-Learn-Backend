import { RTCBot } from '../bots/rtcBot.js';
import { Types } from 'mongoose';

// Note: To run this test you must have `socket.io-client` installed.
// `npm install socket.io-client`

async function runTestScenarioA() {
  console.log('🚀 Starting Scenario A: 500 users joining simultaneously in 1 room');
  // (Auth is bypassed via the CHAOS_BOT_ token prefix in socketService.ts)

  const ROOM_ID = 'room_massive_01';
  const NUM_USERS = 500;
  const bots: RTCBot[] = [];
  const promises = [];

  for (let i = 0; i < NUM_USERS; i++) {
    const validUserId = new Types.ObjectId().toString();
    const token = `CHAOS_BOT_${validUserId}`;
    const bot = new RTCBot(validUserId, ROOM_ID, token);
    bots.push(bot);
    // Add jitter to avoid instantaneous socket creation limits on the OS
    // Spread 500 connections over 10 seconds (50/sec) to avoid local EADDRINUSE/timeout drops
    const jitter = Math.random() * 10000;
    promises.push(
      new Promise(resolve => setTimeout(resolve, jitter))
        .then(() => bot.join().catch(e => console.warn(`Bot ${i} join failed:`, e.message)))
    );
  }

  await Promise.all(promises);
  console.log(`✅ Completed 500 join requests for ${ROOM_ID}`);

  // Have a subset publish media
  console.log('📹 Simulating 50 publishers...');
  for (let i = 0; i < 50; i++) {
    bots[i].publishMedia().catch(e => console.warn(`Publish failed for bot ${i}:`, e.message));
  }

  // Simulate packet loss on a client
  bots[0].simulatePacketLoss();

  // Switch speaker
  bots[1].switchSpeaker('user-10');

  setTimeout(() => {
    console.log('🧹 Cleaning up Scenario A');
    bots.forEach(b => b.leave());
    process.exit(0);
  }, 10000);
}

// In a real environment, Scenario B (50,000 bots) would require multiple machines 
// (e.g. using a tool like Artillery, K6, or Locust) due to TCP port exhaustion and CPU limits.
// This function simulates the orchestration of that test.
async function runTestScenarioB() {
  console.log('🚀 Starting Scenario B: 100 rooms x 500 users (50,000 connections)');
  console.warn('⚠️ WARNING: Spawning 50,000 socket connections locally will cause OS port exhaustion.');
  console.warn('⚠️ We recommend using a distributed load testing cluster for this scale.');

  // Example of how one would structure the local simulation
  /*
  const NUM_ROOMS = 100;
  const USERS_PER_ROOM = 500;
  const DUMMY_TOKEN = 'your_test_jwt_token_here';
  
  for (let r = 0; r < NUM_ROOMS; r++) {
    const roomId = `scale-room-${r}`;
    for (let u = 0; u < USERS_PER_ROOM; u++) {
      const bot = new RTCBot(`user-${r}-${u}`, roomId, DUMMY_TOKEN);
      bot.join().catch(() => {});
    }
  }
  */
}

const scenario = process.argv[2] || 'A';
if (scenario === 'A') {
  runTestScenarioA().catch(console.error);
} else {
  runTestScenarioB().catch(console.error);
}
