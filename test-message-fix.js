const http = require('http');

// Test configuration
const SESSION_COOKIE = 'session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiY2FjMTU5MzYtOGRlOS00MWE0LWEwNDEtNGUxOWRhNzhiMDE2IiwiaWF0IjoxNzM0NDMzMjAwLCJleHAiOjE3MzQ1MTk2MDB9.Y7jQArmQXbg4HBBqwfNQ-k5O6GYG2IjE5h1o0C2VD8o';

async function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': SESSION_COOKIE
      }
    };

    const req = http.request(options, (res) => {
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
    req.end();
  });
}

async function testMessageFix() {
  console.log('=== Testing Message Fix for Profile Types ===\n');
  
  try {
    const otherUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    
    console.log('1. Testing basic profile conversations...');
    const basicConvs = await makeRequest('/api/private-conversations?profile_type=basic');
    console.log(`Basic conversations: ${basicConvs.data.conversations?.length || 0}`);
    
    console.log('\n2. Testing love profile conversations...');
    const loveConvs = await makeRequest('/api/private-conversations?profile_type=love');
    console.log(`Love conversations: ${loveConvs.data.conversations?.length || 0}`);
    
    console.log('\n3. Testing business profile conversations...');
    const businessConvs = await makeRequest('/api/private-conversations?profile_type=business');
    console.log(`Business conversations: ${businessConvs.data.conversations?.length || 0}`);
    
    console.log('\n4. Testing basic profile messages...');
    const basicMsgs = await makeRequest(`/api/messages?other_user_id=${otherUserId}&sender_profile_type=basic&receiver_profile_type=basic`);
    console.log(`Basic messages: ${basicMsgs.data.messages?.length || 0}`);
    
    console.log('\n5. Testing love profile messages...');
    const loveMsgs = await makeRequest(`/api/messages?other_user_id=${otherUserId}&sender_profile_type=love&receiver_profile_type=love`);
    console.log(`Love messages: ${loveMsgs.data.messages?.length || 0}`);
    
    console.log('\n6. Testing business profile messages...');
    const businessMsgs = await makeRequest(`/api/messages?other_user_id=${otherUserId}&sender_profile_type=business&receiver_profile_type=business`);
    console.log(`Business messages: ${businessMsgs.data.messages?.length || 0}`);
    
    console.log('\n7. Testing all conversations (no filter)...');
    const allConvs = await makeRequest('/api/private-conversations');
    console.log(`All conversations: ${allConvs.data.conversations?.length || 0}`);
    
    console.log('\n8. Testing all messages (no filter)...');
    const allMsgs = await makeRequest(`/api/messages?other_user_id=${otherUserId}`);
    console.log(`All messages: ${allMsgs.data.messages?.length || 0}`);
    
    // Check if legacy messages are now visible in all profile types
    if (basicMsgs.data.messages && loveMsgs.data.messages && businessMsgs.data.messages) {
      const basicCount = basicMsgs.data.messages.length;
      const loveCount = loveMsgs.data.messages.length;
      const businessCount = businessMsgs.data.messages.length;
      
      console.log('\n=== Results Analysis ===');
      console.log(`Basic profile shows: ${basicCount} messages`);
      console.log(`Love profile shows: ${loveCount} messages`);
      console.log(`Business profile shows: ${businessCount} messages`);
      
      if (basicCount > 0 && loveCount > 0 && businessCount > 0) {
        console.log('✅ SUCCESS: All profile types now show messages (including legacy)');
      } else {
        console.log('❌ ISSUE: Some profile types still show no messages');
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMessageFix().catch(console.error);
