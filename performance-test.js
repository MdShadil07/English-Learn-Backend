import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import cors from 'cors';
import authRoutes from '../src/routes/auth/auth.js';

async function createTestServer() {
  // Start in-memory MongoDB
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create Express app for testing
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/auth', authRoutes);

  // Add error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  return { app, mongoServer };
}

async function performanceTest() {
  console.log('🚀 Starting Performance Test Setup...');

  const { app, mongoServer } = await createTestServer();
  const server = app.listen(5000, () => {
    console.log('✅ Test server started on port 5000');
  });

  // Generate test data
  const generateTestUser = (index: number) => ({
    email: `testuser${index}@example.com`,
    password: 'TestPassword123!',
    firstName: `Test${index}`,
    lastName: `User${index}`,
    username: `testuser${index}`,
    targetLanguage: 'English',
    nativeLanguage: 'Spanish',
    country: 'Test Country',
    proficiencyLevel: 'beginner',
    role: 'student'
  });

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test health endpoint first
  try {
    const healthResponse = await fetch('http://localhost:5000/api/health');
    if (healthResponse.ok) {
      console.log('✅ Health check passed');
    } else {
      console.log('❌ Health check failed');
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
  }

  const totalRequests = 1000;
  const targetTimeMs = 60000; // 1 minute
  const concurrentRequests = 50;

  console.log(`\n🚀 Starting performance test: ${totalRequests} requests in ${targetTimeMs/1000} seconds`);
  console.log(`📊 Concurrent requests: ${concurrentRequests}`);

  const startTime = Date.now();
  const results = {
    success: 0,
    failed: 0,
    responseTimes: [] as number[],
    errors: [] as string[]
  };

  // Function to send requests in batches
  async function sendBatch(startIndex: number, batchSize: number): Promise<void> {
    const promises = [];

    for (let i = startIndex; i < startIndex + batchSize && i < totalRequests; i++) {
      const testUser = generateTestUser(i);

      const requestPromise = fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testUser)
      })
      .then(async (response) => {
        const requestStartTime = Date.now();
        if (response.status === 201 || response.status === 409) {
          results.success++;
        } else {
          results.failed++;
          const errorText = await response.text();
          results.errors.push(`Request ${i}: Status ${response.status} - ${errorText}`);
        }
        results.responseTimes.push(Date.now() - requestStartTime);
      })
      .catch((error) => {
        results.failed++;
        results.errors.push(`Request ${i}: ${error.message}`);
      });

      promises.push(requestPromise);
    }

    await Promise.allSettled(promises);
  }

  // Send requests in batches
  for (let batch = 0; batch < totalRequests; batch += concurrentRequests) {
    await sendBatch(batch, concurrentRequests);

    // Log progress every 100 requests
    if ((batch + concurrentRequests) % 100 === 0) {
      const currentTime = Date.now() - startTime;
      const requestsSent = Math.min(batch + concurrentRequests, totalRequests);
      console.log(`📈 Progress: ${requestsSent}/${totalRequests} requests (${Math.round((requestsSent/totalRequests)*100)}%) - ${currentTime}ms elapsed`);
    }
  }

  const totalTime = Date.now() - startTime;
  const requestsPerSecond = (totalRequests / totalTime) * 1000;
  const averageResponseTime = results.responseTimes.length > 0
    ? results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length
    : 0;

  console.log('\n📊 PERFORMANCE TEST RESULTS:');
  console.log('================================');
  console.log(`⏱️  Total time: ${totalTime}ms (${(totalTime/1000).toFixed(2)}s)`);
  console.log(`🎯 Target time: ${targetTimeMs}ms (${targetTimeMs/1000}s)`);
  console.log(`✅ Successful requests: ${results.success}`);
  console.log(`❌ Failed requests: ${results.failed}`);
  console.log(`🚀 Requests per second: ${requestsPerSecond.toFixed(2)}`);
  console.log(`⏱️  Average response time: ${averageResponseTime.toFixed(2)}ms`);

  if (results.responseTimes.length > 0) {
    console.log(`📈 Min response time: ${Math.min(...results.responseTimes)}ms`);
    console.log(`📉 Max response time: ${Math.max(...results.responseTimes)}ms`);
  }

  // Performance analysis
  const withinTargetTime = totalTime <= targetTimeMs * 1.5; // 50% tolerance
  const acceptableFailureRate = results.failed < totalRequests * 0.1; // Less than 10% failure rate
  const goodResponseTime = averageResponseTime < 2000; // Average under 2 seconds
  const goodThroughput = requestsPerSecond > 10; // At least 10 requests per second

  console.log('\n🎯 PERFORMANCE ANALYSIS:');
  console.log('========================');
  console.log(`⏱️  Within target time (±50%): ${withinTargetTime ? '✅' : '❌'}`);
  console.log(`📊 Failure rate < 10%: ${acceptableFailureRate ? '✅' : '❌'}`);
  console.log(`⚡ Average response time < 2s: ${goodResponseTime ? '✅' : '❌'}`);
  console.log(`🚀 Throughput > 10 req/s: ${goodThroughput ? '✅' : '❌'}`);

  if (results.errors.length > 0) {
    console.log('\n❌ ERRORS ENCOUNTERED:');
    results.errors.slice(0, 10).forEach(error => console.log(`   ${error}`));
    if (results.errors.length > 10) {
      console.log(`   ... and ${results.errors.length - 10} more errors`);
    }
  }

  // Cleanup
  server.close();
  await mongoose.disconnect();
  await mongoServer.stop();

  console.log('\n🏁 Performance test completed!');
}

// Run the performance test
if (import.meta.url === `file://${process.argv[1]}`) {
  performanceTest().catch(console.error);
}

export { performanceTest, createTestServer };
