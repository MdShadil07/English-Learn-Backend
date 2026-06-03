import { redisCache } from '../../config/redis.js';

async function run() {
  console.log('🔥 Chaos Testing: Simulating Redis Outage');
  
  await redisCache.connect();
  console.log('Connected to Redis normally.');
  
  // Simulate network partition/disconnect
  console.log('Disconnecting Redis to simulate outage...');
  await redisCache.disconnect();
  
  console.log('Redis disconnected. Observe application logs to verify fallback mechanisms (e.g., bypassing hot room protection) are working.');
  
  // Wait 10 seconds and reconnect
  console.log('Waiting 10 seconds before recovery...');
  setTimeout(async () => {
    console.log('Reconnecting Redis to simulate recovery...');
    await redisCache.connect();
    console.log('Recovery complete.');
    process.exit(0);
  }, 10000);
}

run().catch(console.error);
