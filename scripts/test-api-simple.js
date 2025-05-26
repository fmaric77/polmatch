// Simple authenticated API performance test
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function runSimpleTest() {
  console.log('🧪 Simple Authenticated Performance Test');
  
  try {
    // Step 1: Login
    console.log('\n1️⃣ Logging in...');
    const startLogin = Date.now();
    
    const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
      email: 'sokol@example.com',
      password: 'mango'
    }, {
      timeout: 30000
    });
    
    const loginDuration = Date.now() - startLogin;
    console.log(`✅ Login successful: ${loginDuration}ms`);
    
    // Extract session cookie
    const cookies = loginResponse.headers['set-cookie'];
    const sessionCookie = cookies?.find(cookie => cookie.includes('session='))?.split(';')[0];
    
    if (!sessionCookie) {
      throw new Error('No session cookie found');
    }
    
    console.log(`🍪 Session: ${sessionCookie.substring(0, 20)}...`);
    
    // Step 2: Test API endpoints
    console.log('\n2️⃣ Testing API endpoints...');
    
    const endpoints = [
      '/api/session',
      '/api/users/profile-picture?user_id=f47ac10b-58cc-4372-a567-0e02b2c3d479',
      '/api/messages',
      '/api/test-performance'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const start = Date.now();
        const response = await axios.get(`${BASE_URL}${endpoint}`, {
          headers: { 'Cookie': sessionCookie },
          timeout: 30000
        });
        const duration = Date.now() - start;
        
        console.log(`✅ ${endpoint}: ${duration}ms (${response.status})`);
      } catch (error) {
        console.log(`❌ ${endpoint}: ERROR - ${error.message}`);
      }
    }
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

runSimpleTest();
