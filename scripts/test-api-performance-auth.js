const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 10000; // 10 seconds

// Test configuration
const TEST_USER = {
  email: 'sokol@example.com',
  password: 'mango'
};

async function loginAndGetSession() {
  try {
    const response = await axios.post(`${BASE_URL}/api/login`, TEST_USER, {
      timeout: TIMEOUT,
      withCredentials: true
    });
    
    // Extract session cookie from response headers
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      const sessionCookie = cookies.find(cookie => cookie.includes('session='));
      if (sessionCookie) {
        return sessionCookie.split(';')[0]; // Get just the session=value part
      }
    }
    throw new Error('No session cookie found');
  } catch (error) {
    throw new Error(`Login failed: ${error.message}`);
  }
}

async function testAPIWithAuth(endpoint, sessionCookie, method = 'GET', data = null) {
  const startTime = Date.now();
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      timeout: TIMEOUT,
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return {
      success: true,
      status: response.status,
      duration: `${duration}ms`,
      dataReceived: response.data ? Object.keys(response.data).length : 0
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return {
      success: false,
      error: error.response ? `Status ${error.response.status}` : error.message,
      duration: `${duration}ms`
    };
  }
}

async function testConcurrentRequests(sessionCookie, count = 10) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🔄 Testing ${count} Concurrent Requests...`);
  
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(testAPIWithAuth('/api/session', sessionCookie));
  }
  
  const startTime = Date.now();
  try {
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const avgDuration = results.reduce((sum, r) => {
      const ms = parseInt(r.duration.replace('ms', ''));
      return sum + ms;
    }, 0) / results.length;
    
    console.log(`✅ Concurrent test results:`);
    console.log(`   • Total time: ${totalDuration}ms`);
    console.log(`   • Successful: ${successful}/${count}`);
    console.log(`   • Failed: ${failed}/${count}`);
    console.log(`   • Average response time: ${Math.round(avgDuration)}ms`);
    console.log(`   • Requests per second: ${Math.round((count * 1000) / totalDuration)}`);
    
  } catch (error) {
    console.log(`❌ Concurrent test failed: ${error.message}`);
  }
}

function analyzePerformance(duration) {
  const ms = parseInt(duration.replace('ms', ''));
  if (ms < 500) return '🟢 Excellent';
  if (ms < 1000) return '🟡 Good';
  if (ms < 2000) return '🟠 Acceptable';
  return '🔴 Slow';
}

async function runPerformanceTests() {
  console.log('🧪 Authenticated API Performance Test Suite');
  console.log('Using credentials: sokol@example.com with password mango');
  
  try {
    // Step 1: Login and get session
    console.log('\n📡 Getting authentication session...');
    const sessionCookie = await loginAndGetSession();
    console.log('✅ Authentication successful');
    
    console.log(`\n${'='.repeat(50)}`);
    console.log('🔍 Testing API Performance...');
    
    // Test endpoints
    const endpoints = [
      { name: 'Session Check', url: '/api/session' },
      { name: 'Profile Picture', url: '/api/users/profile-picture?user_id=f47ac10b-58cc-4372-a567-0e02b2c3d479' },
      { name: 'Messages', url: '/api/messages' },
      { name: 'Private Conversations', url: '/api/private-conversations' },
      { name: 'Groups List', url: '/api/groups/list' },
      { name: 'Test Performance', url: '/api/test-performance' }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      console.log(`\n📡 Testing ${endpoint.name}...`);
      const result = await testAPIWithAuth(endpoint.url, sessionCookie);
      
      if (result.success) {
        console.log(`✅ ${endpoint.name}: ${result.duration} ${analyzePerformance(result.duration)}`);
        results.push({
          name: endpoint.name,
          duration: parseInt(result.duration.replace('ms', '')),
          success: true
        });
      } else {
        console.log(`❌ ${endpoint.name}: Error - ${result.error} (${result.duration})`);
        results.push({
          name: endpoint.name,
          duration: parseInt(result.duration.replace('ms', '')),
          success: false,
          error: result.error
        });
      }
    }
    
    // Concurrent testing
    await testConcurrentRequests(sessionCookie, 10);
    
    // Performance analysis
    console.log(`\n${'='.repeat(50)}`);
    console.log('📊 Performance Analysis Summary:');
    
    const successfulTests = results.filter(r => r.success);
    if (successfulTests.length > 0) {
      const avgDuration = successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length;
      const maxDuration = Math.max(...successfulTests.map(r => r.duration));
      const minDuration = Math.min(...successfulTests.map(r => r.duration));
      
      console.log(`   • Average response time: ${Math.round(avgDuration)}ms`);
      console.log(`   • Fastest response: ${minDuration}ms`);
      console.log(`   • Slowest response: ${maxDuration}ms`);
      console.log(`   • Success rate: ${successfulTests.length}/${results.length} (${Math.round((successfulTests.length/results.length)*100)}%)`);
      
      console.log('\n🎯 Performance Categories:');
      console.log('   • Excellent (< 500ms): 🟢');
      console.log('   • Good (500-1000ms): 🟡');
      console.log('   • Acceptable (1000-2000ms): 🟠');
      console.log('   • Slow (> 2000ms): 🔴');
      
      // Show improvement from original 4-6 second baseline
      if (avgDuration < 2000) {
        const improvementFromBaseline = ((5000 - avgDuration) / 5000) * 100;
        console.log(`\n🚀 Performance Improvement: ${Math.round(improvementFromBaseline)}% faster than original 4-6s baseline!`);
      }
    }
    
    console.log('\nPerformance test completed!');
    
  } catch (error) {
    console.log(`❌ Test suite failed: ${error.message}`);
  }
}

// Run the tests
runPerformanceTests();
