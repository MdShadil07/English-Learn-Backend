import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics for detailed performance analysis
const profileLoadTime = new Trend('profile_load_time');
const authResponseTime = new Trend('auth_response_time');
const searchResponseTime = new Trend('search_response_time');
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users over 2 minutes
    { duration: '5m', target: 100 },   // Stay at 100 users for 5 minutes
    { duration: '2m', target: 500 },   // Ramp up to 500 users over 2 minutes
    { duration: '5m', target: 500 },   // Stay at 500 users for 5 minutes
    { duration: '2m', target: 1000 },  // Ramp up to 1000 users over 2 minutes
    { duration: '5m', target: 1000 },  // Stay at 1000 users for 5 minutes
    { duration: '2m', target: 0 },     // Ramp down to 0 users
  ],

  thresholds: {
    // Performance thresholds for scalability validation
    http_req_duration: ['p(95)<2000'],    // 95% of requests under 2 seconds
    http_req_failed: ['rate<0.1'],        // Error rate under 10%
    profile_load_time: ['p(95)<1500'],    // Profile loads under 1.5 seconds
    auth_response_time: ['p(95)<1000'],   // Auth operations under 1 second
    search_response_time: ['p(95)<2000'], // Search under 2 seconds
    errors: ['rate<0.05'],                // Very low error rate
  },

  // Virtual user configuration
  vus: 1000,
  maxRedirects: 5,
  userAgent: 'k6-load-test/1.0',

  // Test duration and ramping
  duration: '23m',
};

let userCounter = 0;
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Generate test user data
function generateTestUser(index: number) {
  const languages = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese'];
  const levels = ['beginner', 'elementary', 'intermediate', 'advanced', 'proficient'];
  const fields = ['student', 'teacher', 'professional', 'software-engineer', 'business'];

  return {
    email: `loadtest${index}@example.com`,
    password: 'TestPass123!',
    firstName: `Test${index}`,
    lastName: `User${index}`,
    username: `loadtest${index}`,
    targetLanguage: languages[Math.floor(Math.random() * languages.length)],
    nativeLanguage: 'English',
    country: 'Test Country',
    proficiencyLevel: levels[Math.floor(Math.random() * levels.length)],
    role: 'student',
    field: fields[Math.floor(Math.random() * fields.length)]
  };
}

// Setup function - runs before the test starts
export function setup() {
  console.log('🚀 Starting k6 load test setup...');
  console.log(`📊 Target URL: ${BASE_URL}`);
  console.log(`👥 Max VUs: ${options.vus}`);

  // Health check
  const healthResponse = http.get(`${BASE_URL}/api/health`);
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
  });

  console.log('✅ Setup completed');
  return { timestamp: new Date().toISOString() };
}

// Main test function
export default function () {
  const userId = userCounter++;
  const testUser = generateTestUser(userId);

  // Test 1: User Registration (20% of requests)
  if (Math.random() < 0.2) {
    const startTime = new Date().getTime();
    const response = http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify(testUser),
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: '10s',
      }
    );

    const endTime = new Date().getTime();
    authResponseTime.add(endTime - startTime);

    check(response, {
      'registration status is 201 or 409': (r) => r.status === 201 || r.status === 409,
      'registration response time < 3s': (r) => (endTime - startTime) < 3000,
    });

    if (response.status >= 400) {
      errorRate.add(true);
    }
  }

  // Test 2: User Login (30% of requests)
  else if (Math.random() < 0.5) {
    const startTime = new Date().getTime();
    const response = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: '10s',
      }
    );

    const endTime = new Date().getTime();
    authResponseTime.add(endTime - startTime);

    check(response, {
      'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'login response time < 2s': (r) => (endTime - startTime) < 2000,
    });

    if (response.status >= 400) {
      errorRate.add(true);
    }
  }

  // Test 3: Profile Fetch (25% of requests)
  else if (Math.random() < 0.75) {
    const startTime = new Date().getTime();
    const response = http.get(`${BASE_URL}/api/auth/profile`, {
      timeout: '10s',
    });

    const endTime = new Date().getTime();
    profileLoadTime.add(endTime - startTime);

    check(response, {
      'profile status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'profile response time < 1.5s': (r) => (endTime - startTime) < 1500,
    });

    if (response.status >= 400) {
      errorRate.add(true);
    }
  }

  // Test 4: Profile Search (15% of requests)
  else {
    const startTime = new Date().getTime();
    const searchQuery = ['english', 'spanish', 'teacher', 'student', 'professional'][Math.floor(Math.random() * 5)];

    const response = http.get(
      `${BASE_URL}/api/profile/search?q=${encodeURIComponent(searchQuery)}&limit=10`,
      {
        timeout: '10s',
      }
    );

    const endTime = new Date().getTime();
    searchResponseTime.add(endTime - startTime);

    check(response, {
      'search status is 200': (r) => r.status === 200,
      'search response time < 2s': (r) => (endTime - startTime) < 2000,
    });

    if (response.status >= 400) {
      errorRate.add(true);
    }
  }

  // Test 5: Profile Update (10% of requests)
  if (Math.random() < 0.1) {
    const startTime = new Date().getTime();
    const response = http.put(
      `${BASE_URL}/api/auth/profile`,
      JSON.stringify({
        bio: `Updated bio for load test user ${userId}`,
        location: 'Updated Location',
        targetLanguage: testUser.targetLanguage,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: '10s',
      }
    );

    const endTime = new Date().getTime();

    check(response, {
      'profile update status is 200': (r) => r.status === 200,
      'profile update response time < 2s': (r) => (endTime - startTime) < 2000,
    });

    if (response.status >= 400) {
      errorRate.add(true);
    }
  }

  // Simulate realistic user behavior
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds between requests
}

// Teardown function - runs after test completes
export function teardown(data: any) {
  console.log('🏁 Load test completed');
  console.log(`📊 Test started at: ${data.timestamp}`);
  console.log(`⏰ Test ended at: ${new Date().toISOString()}`);
}

// Handle summary output
export function handleSummary(data: any) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
