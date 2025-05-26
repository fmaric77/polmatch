// Comprehensive authenticated API performance test
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function runComprehensiveTest() {
  console.log('🧪 Comprehensive Performance Test Suite');
  console.log(`Testing at: ${BASE_URL}`);
  
  try {
    // Step 1: Login
    console.log('\n1️⃣ Authenticating...');
    const loginStart = Date.now();
    
    const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
      email: 'sokol@example.com',
      password: 'mango'
    }, { timeout: 30000 });
    
    const loginDuration = Date.now() - loginStart;
    console.log(`✅ Login: ${loginDuration}ms`);
    
    const sessionCookie = loginResponse.headers['set-cookie']
      ?.find(cookie => cookie.includes('session='))?.split(';')[0];
    
    if (!sessionCookie) throw new Error('No session cookie found');
    
    // Step 2: Test multiple API endpoints
    console.log('\n2️⃣ Testing API Performance...');
    
    const endpoints = [
      { name: 'Session Check', url: '/api/session' },
      { name: 'Profile Picture', url: '/api/users/profile-picture?user_id=f47ac10b-58cc-4372-a567-0e02b2c3d479' },
      { name: 'Messages', url: '/api/messages' },
      { name: 'Groups List', url: '/api/groups/list' },
      { name: 'Private Conversations', url: '/api/private-conversations' },
      { name: 'Test Performance', url: '/api/test-performance' }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
      try {
        const start = Date.now();
        const response = await axios.get(`${BASE_URL}${endpoint.url}`, {
          headers: { 'Cookie': sessionCookie },
          timeout: 30000
        });
        const duration = Date.now() - start;
        
        const performance = duration < 500 ? '🟢 Excellent' : 
                          duration < 1000 ? '🟡 Good' : 
                          duration < 2000 ? '🟠 Acceptable' : '🔴 Slow';
        
        console.log(`✅ ${endpoint.name}: ${duration}ms ${performance}`);
        results.push({ name: endpoint.name, duration, success: true });
      } catch (error) {
        console.log(`❌ ${endpoint.name}: ERROR - ${error.message}`);
        results.push({ name: endpoint.name, success: false, error: error.message });
      }
    }
    
    // Step 3: Concurrent testing
    console.log('\n3️⃣ Testing Concurrent Performance...');
    
    const concurrentCount = 5;
    const promises = [];
    
    for (let i = 0; i < concurrentCount; i++) {
      promises.push(
        axios.get(`${BASE_URL}/api/session`, {
          headers: { 'Cookie': sessionCookie },
          timeout: 30000
        })
      );
    }
    
    const concurrentStart = Date.now();
    try {
      const concurrentResults = await Promise.all(promises);
      const concurrentDuration = Date.now() - concurrentStart;
      const avgResponse = concurrentDuration / concurrentCount;
      
      console.log(`✅ ${concurrentCount} concurrent requests: ${concurrentDuration}ms total, ${Math.round(avgResponse)}ms avg`);
    } catch (error) {
      console.log(`❌ Concurrent test failed: ${error.message}`);
    }
    
    // Step 4: Performance Summary
    console.log('\n4️⃣ Performance Summary:');
    const successfulTests = results.filter(r => r.success);
    
    if (successfulTests.length > 0) {
      const avgDuration = successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length;
      const maxDuration = Math.max(...successfulTests.map(r => r.duration));
      const minDuration = Math.min(...successfulTests.map(r => r.duration));
      
      console.log(`📊 Statistics:`);
      console.log(`   • Average response time: ${Math.round(avgDuration)}ms`);
      console.log(`   • Fastest response: ${minDuration}ms`);
      console.log(`   • Slowest response: ${maxDuration}ms`);
      console.log(`   • Success rate: ${successfulTests.length}/${results.length} (${Math.round((successfulTests.length/results.length)*100)}%)`);
      
      // Compare with original baseline (4-6 seconds)
      const baselineImprovement = ((5000 - avgDuration) / 5000) * 100;
      console.log(`\n🚀 Performance Improvement:`);
      console.log(`   • ${Math.round(baselineImprovement)}% faster than 4-6s baseline`);
      console.log(`   • From ~5000ms to ~${Math.round(avgDuration)}ms average`);
      
      if (avgDuration < 1000) {
        console.log(`   • 🎯 Target achieved: Sub-second response times!`);
      }
    }
    
    console.log('\n✅ Comprehensive test completed!');
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

runComprehensiveTest();
