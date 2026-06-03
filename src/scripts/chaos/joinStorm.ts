import { hotRoomProtectionService } from '../../services/Room/hotRoomProtectionService.js';
import { redisCache } from '../../config/redis.js';
import { startRoomJoinWorker } from '../../workers/roomJoinWorker.js';
import { QueueEvents } from 'bullmq';

async function run() {
  console.log('🔥 Chaos Testing: Simulating Room Join Storm');
  
  await redisCache.connect();
  const TEST_ROOM_ID = 'chaos-test-room-999';
  
  const worker = startRoomJoinWorker();
  
  const bullMqClient = redisCache.createBullMQClient();
  const queueEvents = new QueueEvents('room-join-queue', { connection: bullMqClient });
  let queuedUsersProcessed = 0;
  let totalQueued = 0;

  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    // BullMQ converts objects in returnvalue to JSON string or object depending on version
    // Assume it's an object here as returned by worker
    const val = typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue;
    console.log(`✅ User ${val.userId} joined successfully from the queue at ${new Date().toISOString()}`);
    queuedUsersProcessed++;
    if (queuedUsersProcessed === totalQueued) {
      console.log('Join storm simulation completely finished all queued jobs.');
      cleanupAndExit();
    }
  });

  console.log(`Blasting room ${TEST_ROOM_ID} with 100 concurrent join requests...`);
  
  const promises = [];
  for (let i = 0; i < 100; i++) {
    const userId = `user-${i}`;
    promises.push(
      hotRoomProtectionService.canJoinRoom(TEST_ROOM_ID, userId)
        .then(result => {
          if (result.allowed) {
            console.log(`✅ User ${userId} joined instantly.`);
          } else if (result.queued) {
            totalQueued++;
            console.log(`⏱️  User ${userId} placed in queue at position ${result.position}. (Reason: ${result.reason})`);
          } else {
            console.log(`🛑 User ${userId} blocked: ${result.reason} (Retry after ${result.retryAfterMs}ms)`);
          }
        })
    );
  }
  
  await Promise.all(promises);
  console.log('Join requests submitted. Waiting for queue to process remaining users...');
  
  if (totalQueued === 0) {
    cleanupAndExit();
  }

  async function cleanupAndExit() {
    const client = redisCache.getClient();
    if (client) {
      await client.del(`room_joins:${TEST_ROOM_ID}`);
      console.log('Cleaned up test Redis key.');
    }
    
    await worker?.close();
    await queueEvents.close();
    bullMqClient.disconnect();
    await redisCache.disconnect();
    process.exit(0);
  }
}

run().catch(console.error);
