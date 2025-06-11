const https = require('https');

// Test configuration
const HOST = 'localhost:3000';
const SESSION_COOKIE = 'session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjczYjY0MmYxMzA0YzM5Yzk1ZGNlODVlIiwiaWF0IjoxNzM0MjEwNjc3LCJleHAiOjE3MzQyOTcwNzd9.nfD6cJ4Ft1B5CyRd2RKHvzL7tgAh2bM0OlR5EwDGNpU';

// Test user credentials
const TEST_EMAIL = 'sokol@example.com';
const TEST_PASSWORD = 'mango';

async function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': SESSION_COOKIE
      },
      rejectUnauthorized: false
    };

    const req = (path.startsWith('https') ? https : require('http')).request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testProfileConversations() {
  console.log('=== Testing Profile Conversations System ===\n');
  
  try {
    // Test 1: Check basic conversations
    console.log('1. Testing basic profile conversations...');
    const basicResult = await makeRequest('/api/private-conversations?profile_type=basic');
    console.log('Basic conversations status:', basicResult.status);
    console.log('Basic conversations data:', JSON.stringify(basicResult.data, null, 2));
    
    // Test 2: Check love conversations  
    console.log('\n2. Testing love profile conversations...');
    const loveResult = await makeRequest('/api/private-conversations?profile_type=love');
    console.log('Love conversations status:', loveResult.status);
    console.log('Love conversations data:', JSON.stringify(loveResult.data, null, 2));
    
    // Test 3: Check business conversations
    console.log('\n3. Testing business profile conversations...');
    const businessResult = await makeRequest('/api/private-conversations?profile_type=business');
    console.log('Business conversations status:', businessResult.status);
    console.log('Business conversations data:', JSON.stringify(businessResult.data, null, 2));
    
    // Test 4: Check all conversations (no filter)
    console.log('\n4. Testing all conversations (no filter)...');
    const allResult = await makeRequest('/api/private-conversations');
    console.log('All conversations status:', allResult.status);
    console.log('All conversations data:', JSON.stringify(allResult.data, null, 2));
    
    // Test 5: Check if discover API works for love profiles
    console.log('\n5. Testing discover API for love profiles...');
    const discoverResult = await makeRequest('/api/users/discover?profile_type=love&sender_profile_type=love');
    console.log('Discover love profiles status:', discoverResult.status);
    console.log('Discover love profiles data:', JSON.stringify(discoverResult.data, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testProfileConversations().catch(console.error);
