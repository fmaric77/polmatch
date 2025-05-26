const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Test endpoints with timing
async function testAPIPerformance() {
  console.log('🔍 Testing API Performance...\n');

  const endpoints = [
    { name: 'Session Check', url: '/api/session' },
    { name: 'Profile Picture', url: '/api/users/profile-picture?user_id=test-user' },
    { name: 'Messages', url: '/api/messages' },
    { name: 'Private Conversations', url: '/api/private-conversations' },
    { name: 'Groups List', url: '/api/groups/list' },
  ];

  for (const endpoint of endpoints) {
    console.log(`📡 Testing ${endpoint.name}...`);
    
    try {
      const start = Date.now();
      const response = await axios.get(`${BASE_URL}${endpoint.url}`, {
        timeout: 10000,
        headers: {
          'Cookie': 'session=test-session-token'
        }
      });
      const duration = Date.now() - start;
      
      console.log(`✅ ${endpoint.name}: ${duration}ms (Status: ${response.status})`);
      
      if (duration > 2000) {
        console.log(`⚠️  WARNING: ${endpoint.name} took ${duration}ms - this is still slow!`);
      } else if (duration < 500) {
        console.log(`🚀 FAST: ${endpoint.name} completed in ${duration}ms`);
      }
      
    } catch (error) {
      console.log(`❌ ${endpoint.name}: Error - ${error.message}`);
    }
    
    console.log('');
  }

  console.log('Performance test completed!');
}

// Test database connection pooling by making concurrent requests
async function testConcurrentRequests() {
  console.log('🔄 Testing Concurrent Requests...\n');

  const promises = [];
  const numRequests = 10;

  for (let i = 0; i < numRequests; i++) {
    promises.push(
      axios.get(`${BASE_URL}/api/session`, {
        timeout: 10000,
        headers: {
          'Cookie': 'session=test-session-token'
        }
      })
    );
  }

  const start = Date.now();
  try {
    const results = await Promise.all(promises);
    const duration = Date.now() - start;
    
    console.log(`✅ ${numRequests} concurrent requests completed in ${duration}ms`);
    console.log(`📊 Average per request: ${duration / numRequests}ms`);
    
    if (duration / numRequests > 1000) {
      console.log(`⚠️  Connection pooling may not be working properly`);
    } else {
      console.log(`🚀 Connection pooling appears to be working well!`);
    }
    
  } catch (error) {
    console.log(`❌ Concurrent test failed: ${error.message}`);
  }
}

// Main test function
async function main() {
  console.log('🧪 API Performance Test Suite\n');
  console.log('='.repeat(50));
  
  await testAPIPerformance();
  console.log('\n' + '='.repeat(50));
  await testConcurrentRequests();
  
  console.log('\n🎯 Performance Analysis:');
  console.log('• Good performance: < 500ms');
  console.log('• Acceptable: 500-1000ms');
  console.log('• Slow: 1000-2000ms');
  console.log('• Very slow: > 2000ms');
}

main().catch(console.error);
