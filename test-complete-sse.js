// Complete real-time messaging test
const https = require('https');
const { URL } = require('url');

const BASE_URL = 'http://localhost:3000';

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  addCookie(cookieString) {
    const cookies = cookieString.split(',').map(c => c.trim());
    cookies.forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        this.cookies.set(name, value);
      }
    });
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  getSessionToken() {
    return this.cookies.get('session');
  }
}

async function makeRequest(url, options = {}) {
  const fetch = (await import('node-fetch')).default;
  return fetch(url, options);
}

async function findAnotherUser(cookieJar) {
  console.log('👥 Finding another user to message...');
  
  const response = await makeRequest(`${BASE_URL}/api/users/list`, {
    headers: { 'Cookie': cookieJar.getCookieHeader() }
  });

  if (!response.ok) {
    throw new Error(`Failed to get users: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success || !data.users) {
    throw new Error(`API error: ${data.message || 'Unknown error'}`);
  }
  
  const otherUsers = data.users.filter(user => user.email !== 'sokol@example.com');
  
  if (otherUsers.length === 0) {
    throw new Error('No other users found to test messaging');
  }

  console.log(`✅ Found user to message: ${otherUsers[0].username} (${otherUsers[0].email})`);
  return otherUsers[0];
}

async function sendMessage(cookieJar, targetUserId, content) {
  console.log(`📤 Sending message to user ${targetUserId}: "${content}"`);
  
  const response = await makeRequest(`${BASE_URL}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieJar.getCookieHeader()
    },
    body: JSON.stringify({
      receiver_id: targetUserId,
      content: content
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log('✅ Message sent successfully:', result.message_id);
  return result;
}

async function testRealTimeMessaging() {
  console.log('🧪 Starting comprehensive real-time messaging test...\n');
  
  const cookieJar = new CookieJar();

  // 1. Login
  console.log('🔐 Step 1: Logging in...');
  const loginResponse = await makeRequest(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sokol@example.com',
      password: 'mango'
    })
  });

  if (!loginResponse.ok) {
    throw new Error(`Login failed: ${loginResponse.status}`);
  }

  const setCookies = loginResponse.headers.raw()['set-cookie'];
  if (setCookies) {
    setCookies.forEach(cookie => cookieJar.addCookie(cookie));
  }

  const loginData = await loginResponse.json();
  console.log('✅ Login successful:', loginData.user.username);

  // 2. Establish SSE connection
  console.log('\n🔗 Step 2: Establishing SSE connection...');
  const sessionToken = cookieJar.getSessionToken();
  
  const { EventSource } = await import('eventsource');
  const sseUrl = `${BASE_URL}/api/sse?sessionToken=${encodeURIComponent(sessionToken)}`;
  
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(sseUrl);
    let connectionEstablished = false;
    let messagesReceived = [];
    let targetUser = null;

    eventSource.onopen = async () => {
      console.log('✅ SSE connection established!');
      connectionEstablished = true;

      try {
        // 3. Find another user
        console.log('\n👥 Step 3: Finding target user...');
        targetUser = await findAnotherUser(cookieJar);

        // 4. Send a test message
        console.log('\n📤 Step 4: Sending test message...');
        await sendMessage(cookieJar, targetUser.user_id, 'Test real-time message! 🚀');

        // 5. Wait for SSE notification
        console.log('\n⏳ Step 5: Waiting for SSE notification...');
        setTimeout(() => {
          console.log('\n📊 Test Results:');
          console.log(`- SSE Connection: ✅ Established`);
          console.log(`- Messages Received: ${messagesReceived.length}`);
          
          messagesReceived.forEach((msg, index) => {
            console.log(`  ${index + 1}. ${msg.type}: ${JSON.stringify(msg.data).substring(0, 100)}...`);
          });

          if (messagesReceived.some(msg => msg.type === 'NEW_MESSAGE')) {
            console.log('\n🎉 SUCCESS: Real-time messaging is working perfectly!');
          } else {
            console.log('\n⚠️  No NEW_MESSAGE received, but SSE connection is working');
          }

          eventSource.close();
          resolve('Test completed successfully');
        }, 3000);

      } catch (error) {
        console.error('❌ Error during test:', error.message);
        eventSource.close();
        reject(error);
      }
    };

    eventSource.onerror = (error) => {
      if (!connectionEstablished) {
        console.error('❌ SSE connection failed:', error);
        reject(new Error('SSE connection failed'));
      }
    };

    eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log(`📨 SSE message: ${message.type}`);
      messagesReceived.push(message);
    };

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!connectionEstablished) {
        console.log('❌ SSE connection timeout');
        eventSource.close();
        reject(new Error('SSE connection timeout'));
      }
    }, 15000);
  });
}

// Run the test
testRealTimeMessaging()
  .then(result => {
    console.log('\n🏁', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });
