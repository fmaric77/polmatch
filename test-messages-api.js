// Direct API test script to verify message filtering logic
const https = require('https');
const http = require('http');

// Disable SSL certificate verification for testing
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testAPI() {
  try {
    console.log('🔑 Testing login API...');
    
    // Step 1: Login
    const loginResponse = await makeRequest('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    console.log('Login response:', loginResponse.status, loginResponse.data);
    
    if (loginResponse.status !== 200 || !loginResponse.data.success) {
      console.error('❌ Login failed!');
      return;
    }
    
    // Extract cookies from login response
    const cookies = loginResponse.headers['set-cookie'] || [];
    const cookieHeader = cookies.join('; ');
    
    console.log('🍪 Cookies:', cookieHeader);
    
    // Step 2: Test session API
    console.log('\n📱 Testing session API...');
    const sessionResponse = await makeRequest('http://localhost:3000/api/session', {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader
      }
    });
    
    console.log('Session response:', sessionResponse.status, sessionResponse.data);
    
    if (sessionResponse.status !== 200 || !sessionResponse.data.valid) {
      console.error('❌ Session validation failed!');
      return;
    }
    
    const currentUserId = sessionResponse.data.user.user_id;
    console.log('✅ Current user ID:', currentUserId);
    
    // Step 3: Test private conversations API
    console.log('\n💬 Testing private conversations API...');
    const conversationsResponse = await makeRequest('http://localhost:3000/api/private-conversations', {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader
      }
    });
    
    console.log('Conversations response:', conversationsResponse.status, conversationsResponse.data);
    
    if (conversationsResponse.status !== 200 || !conversationsResponse.data.success) {
      console.error('❌ Failed to get conversations!');
      return;
    }
    
    const conversations = conversationsResponse.data.conversations;
    if (conversations.length === 0) {
      console.log('📭 No conversations found');
      return;
    }
    
    // Step 4: Test messages API for first conversation
    const firstConversation = conversations[0];
    const otherUserId = firstConversation.other_user.user_id;
    
    console.log(`\n📨 Testing messages API for conversation with user: ${otherUserId}`);
    const messagesResponse = await makeRequest(`http://localhost:3000/api/messages?user_id=${otherUserId}`, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader
      }
    });
    
    console.log('Messages response:', messagesResponse.status, messagesResponse.data);
    
    if (messagesResponse.status !== 200 || !messagesResponse.data.success) {
      console.error('❌ Failed to get messages!');
      return;
    }
    
    // Step 5: Test our new filtering logic
    const messages = messagesResponse.data.messages;
    console.log(`\n🔍 Testing filtering logic...`);
    console.log(`Current user ID: ${currentUserId}`);
    console.log(`Other user ID: ${otherUserId}`);
    console.log(`Total messages from API: ${messages.length}`);
    
    // Show structure of first message
    if (messages.length > 0) {
      console.log('First message structure:', JSON.stringify(messages[0], null, 2));
    }
    
    // Apply our new filtering logic (same as in the component)
    const filteredMessages = messages.filter(msg => 
      msg.sender_id === otherUserId || msg.sender_id === currentUserId
    );
    
    console.log(`Filtered messages count: ${filteredMessages.length}`);
    
    if (filteredMessages.length > 0) {
      console.log('✅ Filtering logic works! Sample filtered message:');
      console.log(JSON.stringify(filteredMessages[0], null, 2));
    } else {
      console.log('❌ No messages after filtering');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();
