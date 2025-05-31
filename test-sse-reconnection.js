// Test SSE reconnection after navigation
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

async function testReconnectionFlow() {
  console.log('🧪 Testing SSE reconnection after navigation...\n');
  
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

  // 2. Simulate the session fetch that happens when UnifiedMessagesRefactored mounts
  console.log('\n📡 Step 2: Testing session fetch (simulating component mount)...');
  const sessionResponse = await makeRequest(`${BASE_URL}/api/session`, {
    headers: {
      'Cookie': cookieJar.getCookieHeader()
    }
  });

  if (!sessionResponse.ok) {
    throw new Error(`Session fetch failed: ${sessionResponse.status}`);
  }

  const sessionData = await sessionResponse.json();
  console.log('✅ Session data received:', {
    valid: sessionData.valid,
    username: sessionData.user.username,
    hasToken: !!sessionData.sessionToken
  });

  if (!sessionData.sessionToken) {
    throw new Error('No session token in session response');
  }

  // 3. Test SSE connection with the token from session API
  console.log('\n🔗 Step 3: Testing SSE connection with session token...');
  
  const { EventSource } = await import('eventsource');
  const sessionToken = sessionData.sessionToken;
  
  return new Promise((resolve, reject) => {
    const sseUrl = `${BASE_URL}/api/sse?sessionToken=${encodeURIComponent(sessionToken)}`;
    console.log('📡 Connecting to:', sseUrl);
    
    const eventSource = new EventSource(sseUrl);
    let connectionEstablished = false;

    eventSource.onopen = () => {
      console.log('✅ SSE connection established!');
      connectionEstablished = true;
    };

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📨 SSE message received:', message.type);
        
        if (message.type === 'CONNECTION_ESTABLISHED') {
          console.log('🎉 CONNECTION_ESTABLISHED received!');
          
          // Give it a moment to ensure stability
          setTimeout(() => {
            eventSource.close();
            resolve('SSE reconnection test passed - connection works after navigation simulation');
          }, 1000);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error);
      eventSource.close();
      reject(new Error('SSE connection failed'));
    };

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!connectionEstablished) {
        eventSource.close();
        reject(new Error('SSE connection timeout'));
      }
    }, 10000);
  });
}

// Run the test
testReconnectionFlow()
  .then(result => {
    console.log('\n🎉', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });
