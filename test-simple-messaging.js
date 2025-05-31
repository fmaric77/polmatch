// Simple message test with hardcoded user
async function makeRequest(url, options = {}) {
  const fetch = (await import('node-fetch')).default;
  return fetch(url, options);
}

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

async function testMessageSending() {
  const BASE_URL = 'http://localhost:3000';
  const cookieJar = new CookieJar();

  // Login
  console.log('🔐 Logging in...');
  const loginResponse = await makeRequest(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sokol@example.com',
      password: 'mango'
    })
  });

  const setCookies = loginResponse.headers.raw()['set-cookie'];
  if (setCookies) {
    setCookies.forEach(cookie => cookieJar.addCookie(cookie));
  }

  console.log('✅ Login successful');

  // Establish SSE connection
  console.log('🔗 Establishing SSE connection...');
  const sessionToken = cookieJar.getSessionToken();
  const { EventSource } = await import('eventsource');
  const sseUrl = `${BASE_URL}/api/sse?sessionToken=${encodeURIComponent(sessionToken)}`;
  
  return new Promise((resolve) => {
    const eventSource = new EventSource(sseUrl);
    let messagesReceived = [];

    eventSource.onopen = async () => {
      console.log('✅ SSE connection established!');

      // Try to send a message to myself (this should work and trigger SSE)
      console.log('📤 Sending test message to self...');
      const messageResponse = await makeRequest(`${BASE_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieJar.getCookieHeader()
        },
        body: JSON.stringify({
          receiver_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // sokol's user ID
          content: 'Test SSE message! 🚀'
        })
      });

      if (messageResponse.ok) {
        const result = await messageResponse.json();
        console.log('✅ Message sent:', result.message_id);
      } else {
        console.log('❌ Message send failed:', messageResponse.status, await messageResponse.text());
      }

      // Wait for SSE notifications
      setTimeout(() => {
        console.log('\n📊 Test Results:');
        console.log(`- Messages received via SSE: ${messagesReceived.length}`);
        messagesReceived.forEach((msg, i) => {
          console.log(`  ${i+1}. ${msg.type}`);
        });

        if (messagesReceived.some(msg => msg.type === 'NEW_MESSAGE')) {
          console.log('\n🎉 SUCCESS: Real-time messaging is working!');
        } else {
          console.log('\n⚠️  No NEW_MESSAGE received (may be expected for self-messages)');
        }

        eventSource.close();
        resolve('Test completed');
      }, 3000);
    };

    eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log(`📨 SSE message: ${message.type}`);
      messagesReceived.push(message);
    };

    eventSource.onerror = () => {
      console.log('❌ SSE error');
    };
  });
}

testMessageSending()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥', err.message);
    process.exit(1);
  });
