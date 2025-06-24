// Direct CSRF test to isolate the issue
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testDirectCSRF() {
  try {
    console.log('🧪 Direct CSRF Test Starting...\n');
    
    // Step 1: Login to get session
    console.log('1. Logging in...');
    const loginRes = await axios.post(`${BASE_URL}/api/login`, {
      email: 'test@example.com', // Update with your test credentials
      password: 'testpassword'
    }, { withCredentials: true });
    
    if (!loginRes.data.success) {
      console.error('❌ Login failed:', loginRes.data.message);
      return;
    }
    console.log('✅ Login successful');
    
    // Extract session cookie
    const cookies = loginRes.headers['set-cookie'];
    const sessionCookie = cookies?.find(cookie => cookie.startsWith('session='));
    console.log('📝 Session cookie:', sessionCookie ? sessionCookie.split(';')[0] : 'not found');
    
    if (!sessionCookie) {
      console.error('❌ No session cookie found');
      return;
    }
    
    // Step 2: Get CSRF token - test multiple times
    for (let i = 1; i <= 3; i++) {
      console.log(`\n--- Attempt ${i} ---`);
      
      console.log(`2.${i} Getting CSRF token...`);
      const tokenRes = await axios.get(`${BASE_URL}/api/csrf-token`, {
        headers: { 'Cookie': sessionCookie },
        timeout: 5000
      });
      
      if (tokenRes.status !== 200) {
        console.error(`❌ CSRF token request failed:`, tokenRes.status);
        continue;
      }
      
      const csrfToken = tokenRes.data.csrfToken;
      console.log(`📝 CSRF token obtained:`, csrfToken.substring(0, 16) + '...');
      
      // Step 3: Immediate 2FA setup attempt
      console.log(`3.${i} Testing 2FA setup immediately...`);
      const setupRes = await axios.post(`${BASE_URL}/api/auth/2fa/setup`, {}, {
        headers: {
          'Cookie': sessionCookie,
          'x-csrf-token': csrfToken,
          'Content-Type': 'application/json'
        },
        timeout: 5000,
        validateStatus: () => true // Accept all status codes
      });
      
      console.log(`📊 Setup Response Status:`, setupRes.status);
      console.log(`📊 Setup Response:`, JSON.stringify(setupRes.data, null, 2));
      
      if (setupRes.status === 200 && setupRes.data.success) {
        console.log(`🎉 SUCCESS on attempt ${i}!`);
        break;
      } else {
        console.log(`❌ Failed on attempt ${i}`);
        
        // Wait a bit before next attempt
        if (i < 3) {
          console.log('⏳ Waiting 2 seconds before next attempt...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.data);
    }
  }
}

console.log('📋 Instructions:');
console.log('1. Make sure your server is running on localhost:3001');
console.log('2. Update the email/password in this script');
console.log('3. Run: node test-csrf-direct.js');
console.log('4. Watch server console for detailed CSRF logs\n');

testDirectCSRF(); 