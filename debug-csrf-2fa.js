const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function debug2FASetup() {
  try {
    console.log('=== Debugging CSRF token flow for 2FA setup ===\n');

    // First, let's get a session by logging in
    console.log('1. Attempting to login...');
    const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
      email: 'test@example.com', // Replace with actual test credentials
      password: 'testpassword'
    }, {
      withCredentials: true,
      timeout: 10000
    });

    if (!loginResponse.data.success) {
      console.error('Login failed:', loginResponse.data.message);
      return;
    }

    console.log('Login successful!');
    
    // Extract session cookie
    const cookies = loginResponse.headers['set-cookie'];
    const sessionCookie = cookies?.find(cookie => cookie.startsWith('session='));
    
    if (!sessionCookie) {
      console.error('No session cookie found');
      return;
    }

    console.log('Session cookie obtained:', sessionCookie.split(';')[0]);

    // 2. Get CSRF token
    console.log('\n2. Fetching CSRF token...');
    const csrfResponse = await axios.get(`${BASE_URL}/api/csrf-token`, {
      headers: {
        'Cookie': sessionCookie
      },
      timeout: 5000
    });

    if (csrfResponse.status !== 200) {
      console.error('Failed to get CSRF token:', csrfResponse.status, csrfResponse.data);
      return;
    }

    const csrfToken = csrfResponse.data.csrfToken;
    console.log('CSRF token obtained:', csrfToken.substring(0, 16) + '...');

    // 3. Test 2FA setup with CSRF token
    console.log('\n3. Testing 2FA setup with CSRF token...');
    const setupResponse = await axios.post(`${BASE_URL}/api/auth/2fa/setup`, {}, {
      headers: {
        'Cookie': sessionCookie,
        'x-csrf-token': csrfToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      validateStatus: function (status) {
        return status < 500; // Accept any status less than 500
      }
    });

    console.log('2FA setup response status:', setupResponse.status);
    console.log('2FA setup response data:', JSON.stringify(setupResponse.data, null, 2));

    if (setupResponse.status === 200 && setupResponse.data.success) {
      console.log('\n✅ 2FA setup successful! CSRF token is working correctly.');
    } else if (setupResponse.status === 403) {
      console.log('\n❌ CSRF validation failed. Response headers:');
      console.log(JSON.stringify(setupResponse.headers, null, 2));
    } else {
      console.log('\n⚠️ Unexpected response:', setupResponse.status, setupResponse.data);
    }

    // 4. Test without CSRF token for comparison
    console.log('\n4. Testing 2FA setup WITHOUT CSRF token (should fail)...');
    const setupWithoutCSRF = await axios.post(`${BASE_URL}/api/auth/2fa/setup`, {}, {
      headers: {
        'Cookie': sessionCookie,
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      validateStatus: function (status) {
        return status < 500;
      }
    });

    console.log('Without CSRF - Status:', setupWithoutCSRF.status);
    console.log('Without CSRF - Data:', JSON.stringify(setupWithoutCSRF.data, null, 2));

  } catch (error) {
    console.error('Error during debugging:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      console.error('Response headers:', error.response.headers);
    }
  }
}

// Add instructions
console.log('To run this debug script:');
console.log('1. Make sure your server is running on localhost:3001');
console.log('2. Update the email/password in the script with valid test credentials');
console.log('3. Run: node debug-csrf-2fa.js\n');

debug2FASetup(); 