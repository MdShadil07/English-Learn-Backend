import { Worker, Job } from 'bullmq';
import { redisCache } from '../config/redis.js';

interface RoomJoinJob {
  roomId: string;
  userId: string;
}

export function startRoomJoinWorker() {
  const bullMqClient = redisCache.createBullMQClient();
  
  if (!bullMqClient) {
    console.error('Cannot start roomJoinWorker: Redis client not available');
    return null;
  }

  console.log('🚀 Starting room-join-queue Worker...');

  const worker = new Worker<RoomJoinJob>(
    'room-join-queue',
    async (job: Job) => {
      const { roomId, userId } = job.data;
      
      // We simulate the processing of the join. In a full implementation, 
      // you would call socketService.notifyRoomJoined(roomId, userId) here.
      console.log(`[BullMQ] Processed queued join for User ${userId} into room ${roomId}`);
      
      // Simulate slight processing delay
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return { success: true, roomId, userId };
    },
    {
      connection: bullMqClient,
      // The crucial part: rate limiting!
      // This ensures we only process a maximum of 50 joins per 10 seconds from the queue,
      // avoiding the thundering herd problem.
      limiter: {
        max: 50,
        duration: 10000,
      },
    }
  );

  worker.on('completed', (job) => {
    // We emit an event to BullMQ's event stream. 
    // The test script will listen to this to print success.
  });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ] Failed to process queued join for job ${job?.id}: ${err.message}`);
  });

  return worker;
}
