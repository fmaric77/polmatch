// Real-time messaging test between two users
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

async function loginUser(email, password) {
  console.log(`🔐 Logging in ${email}...`);
  
  const cookieJar = new CookieJar();

  const loginResponse = await makeRequest(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!loginResponse.ok) {
    throw new Error(`Login failed for ${email}: ${loginResponse.status}`);
  }

  const setCookies = loginResponse.headers.raw()['set-cookie'];
  if (setCookies) {
    setCookies.forEach(cookie => cookieJar.addCookie(cookie));
  }

  const loginData = await loginResponse.json();
  console.log(`✅ Login successful: ${loginData.user.username}`);

  return {
    cookieJar,
    user: loginData.user,
    sessionToken: cookieJar.getSessionToken()
  };
}

async function setupSSEConnection(sessionToken, userId, username) {
  const { EventSource } = await import('eventsource');
  
  return new Promise((resolve, reject) => {
    const sseUrl = `${BASE_URL}/api/sse?sessionToken=${encodeURIComponent(sessionToken)}`;
    console.log(`📡 Setting up SSE for ${username}...`);
    
    const eventSource = new EventSource(sseUrl);
    const messages = [];

    eventSource.onopen = () => {
      console.log(`✅ SSE connected for ${username}`);
      resolve({ eventSource, messages });
    };

    eventSource.onerror = (error) => {
      console.error(`❌ SSE error for ${username}:`, error);
      reject(error);
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log(`📨 ${username} received:`, data.type);
      messages.push(data);
    };

    setTimeout(() => {
      reject(new Error(`SSE timeout for ${username}`));
    }, 10000);
  });
}

async function sendMessage(cookieJar, receiverId, content) {
  const response = await makeRequest(`${BASE_URL}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieJar.getCookieHeader()
    },
    body: JSON.stringify({
      receiver_id: receiverId,
      content: content
    })
  });

  if (!response.ok) {
    throw new Error(`Message send failed: ${response.status} ${await response.text()}`);
  }

  return await response.json();
}

async function testRealtimeMessaging() {
  console.log('🚀 Starting real-time messaging test...\n');

  // Login both users
  const user1 = await loginUser('sokol@example.com', 'mango');
  const user2 = await loginUser('m@m', 'mango');

  console.log(`\n👤 User 1: ${user1.user.username} (${user1.user.user_id})`);
  console.log(`👤 User 2: ${user2.user.username} (${user2.user.user_id})\n`);

  // Setup SSE connections
  const user1SSE = await setupSSEConnection(user1.sessionToken, user1.user.user_id, user1.user.username);
  const user2SSE = await setupSSEConnection(user2.sessionToken, user2.user.user_id, user2.user.username);

  console.log('\n🔗 Both SSE connections established!\n');

  // Wait a moment for connections to stabilize
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send message from user1 to user2
  console.log(`💬 ${user1.user.username} sending message to ${user2.user.username}...`);
  const messageResponse = await sendMessage(user1.cookieJar, user2.user.user_id, 'Hello from real-time test!');
  console.log('✅ Message sent:', messageResponse.message);

  // Wait for SSE messages to arrive
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n📊 Results:');
  console.log(`${user1.user.username} received ${user1SSE.messages.length} SSE messages`);
  console.log(`${user2.user.username} received ${user2SSE.messages.length} SSE messages`);

  user1SSE.messages.forEach((msg, i) => {
    console.log(`  ${user1.user.username}[${i}]: ${msg.type}`);
  });

  user2SSE.messages.forEach((msg, i) => {
    console.log(`  ${user2.user.username}[${i}]: ${msg.type}`);
  });

  // Check if both users received the new message event
  const user1NewMessages = user1SSE.messages.filter(msg => msg.type === 'NEW_MESSAGE');
  const user2NewMessages = user2SSE.messages.filter(msg => msg.type === 'NEW_MESSAGE');

  console.log('\n🎯 Real-time Message Delivery:');
  console.log(`  Sender (${user1.user.username}) notifications: ${user1NewMessages.length}`);
  console.log(`  Receiver (${user2.user.username}) notifications: ${user2NewMessages.length}`);

  if (user1NewMessages.length > 0 && user2NewMessages.length > 0) {
    console.log('✅ Real-time messaging is working correctly!');
  } else {
    console.log('❌ Real-time messaging may have issues');
  }

  // Cleanup
  user1SSE.eventSource.close();
  user2SSE.eventSource.close();

  return {
    success: user1NewMessages.length > 0 && user2NewMessages.length > 0,
    user1Messages: user1NewMessages,
    user2Messages: user2NewMessages
  };
}

// Run the test
testRealtimeMessaging()
  .then(result => {
    console.log('\n🎉 Test completed successfully!');
    if (result.success) {
      console.log('✅ All real-time features working correctly');
    } else {
      console.log('⚠️  Some issues detected with real-time messaging');
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });
