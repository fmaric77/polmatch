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

async function login(email, password) {
  console.log(`🔐 Logging in ${email}...`);
  
  const cookieJar = new CookieJar();

  const loginResponse = await makeRequest(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text();
    throw new Error(`Login failed for ${email}: ${loginResponse.status} ${errorText}`);
  }

  const setCookies = loginResponse.headers.raw()['set-cookie'];
  if (setCookies) {
    setCookies.forEach(cookie => cookieJar.addCookie(cookie));
  }

  const loginData = await loginResponse.json();
  const sessionToken = cookieJar.getSessionToken();
  
  if (!sessionToken) {
    throw new Error(`No session token found for ${email}`);
  }

  console.log(`✅ Login successful for ${loginData.user.username}`);
  return { cookieJar, sessionToken, user: loginData.user };
}

async function setupSSE(sessionToken, username) {
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
      reject(new Error(`SSE connection failed for ${username}`));
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`📨 ${username} received SSE:`, data.type, data.data ? `(${data.data.content || data.data.message || 'no content'})` : '');
        messages.push(data);
      } catch (e) {
        console.log(`📨 ${username} received raw SSE:`, event.data);
        messages.push({ type: 'raw', data: event.data });
      }
    };

    setTimeout(() => {
      reject(new Error(`SSE connection timeout for ${username}`));
    }, 10000);
  });
}

async function sendMessage(cookieJar, recipientUserId, content) {
  const response = await makeRequest(`${BASE_URL}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieJar.getCookieHeader()
    },
    body: JSON.stringify({
      receiver_id: recipientUserId,
      content: content
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send message: ${response.status} ${errorText}`);
  }

  return await response.json();
}

async function testRealTimeMessaging() {
  try {
    // Login both users
    const user1 = await login('sokol@example.com', 'mango');
    const user2 = await login('m@m', 'm');

    // Setup SSE for both users
    const sse1 = await setupSSE(user1.sessionToken, user1.user.username);
    const sse2 = await setupSSE(user2.sessionToken, user2.user.username);

    console.log('\n🚀 Both users connected, starting message test...\n');

    // Wait a moment for connections to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send message from user1 to user2
    const messageContent = `Test message ${Date.now()}`;
    console.log(`📤 ${user1.user.username} sending message to ${user2.user.username}: "${messageContent}"`);
    
    const sentMessage = await sendMessage(user1.cookieJar, user2.user.user_id, messageContent);
    console.log('✅ Message sent successfully:', sentMessage);

    // Wait for SSE messages
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check received messages
    console.log('\n📊 SSE Messages Summary:');
    console.log(`${user1.user.username} received ${sse1.messages.length} SSE messages:`);
    sse1.messages.forEach((msg, i) => {
      console.log(`  ${i + 1}. ${msg.type}: ${JSON.stringify(msg.data || msg).substring(0, 100)}...`);
    });

    console.log(`${user2.user.username} received ${sse2.messages.length} SSE messages:`);
    sse2.messages.forEach((msg, i) => {
      console.log(`  ${i + 1}. ${msg.type}: ${JSON.stringify(msg.data || msg).substring(0, 100)}...`);
    });

    // Check if user2 received the message
    const user2NewMessages = sse2.messages.filter(msg => 
      msg.type === 'NEW_MESSAGE' && 
      msg.data && 
      msg.data.content === messageContent
    );

    if (user2NewMessages.length > 0) {
      console.log('\n✅ Real-time messaging working! User2 received the message via SSE');
    } else {
      console.log('\n⚠️ User2 did not receive the message via SSE');
    }

    // Test for duplicate messages
    const allMessageContents = sse2.messages
      .filter(msg => msg.type === 'NEW_MESSAGE' && msg.data && msg.data.content)
      .map(msg => msg.data.content);
    
    const uniqueContents = [...new Set(allMessageContents)];
    
    if (allMessageContents.length !== uniqueContents.length) {
      console.log('⚠️ Duplicate messages detected in SSE!');
      console.log('All messages:', allMessageContents);
      console.log('Unique messages:', uniqueContents);
    } else {
      console.log('✅ No duplicate messages in SSE');
    }

    // Close connections
    sse1.eventSource.close();
    sse2.eventSource.close();

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
    throw error;
  }
}

// Run the test
testRealTimeMessaging()
  .then(() => {
    console.log('✅ All tests passed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  });
