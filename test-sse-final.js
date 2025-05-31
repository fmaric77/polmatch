// Real-time messaging test with proper cookie handling
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

async function loginAndTestSSE() {
  console.log('🔐 Logging in with sokol@example.com...');
  
  const cookieJar = new CookieJar();

  // Login request
  const loginResponse = await makeRequest(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sokol@example.com',
      password: 'mango'
    })
  });

  if (!loginResponse.ok) {
    throw new Error(`Login failed: ${loginResponse.status} ${await loginResponse.text()}`);
  }

  // Extract cookies
  const setCookies = loginResponse.headers.raw()['set-cookie'];
  if (setCookies) {
    setCookies.forEach(cookie => cookieJar.addCookie(cookie));
  }

  const loginData = await loginResponse.json();
  console.log('✅ Login successful:', loginData.user.username);

  // Get session with cookies
  const sessionToken = cookieJar.getSessionToken();
  if (!sessionToken) {
    throw new Error('No session token found in cookies');
  }

  console.log('🔑 Session token:', sessionToken.substring(0, 10) + '...');

  // Verify session
  const sessionResponse = await makeRequest(`${BASE_URL}/api/session`, {
    headers: {
      'Cookie': cookieJar.getCookieHeader()
    }
  });

  if (!sessionResponse.ok) {
    throw new Error(`Session verification failed: ${sessionResponse.status}`);
  }

  const sessionData = await sessionResponse.json();
  console.log('✅ Session verified for user:', sessionData.user.username);

  // Test SSE connection
  console.log('🔗 Testing SSE connection...');
  
  const { EventSource } = await import('eventsource');
  
  return new Promise((resolve, reject) => {
    const sseUrl = `${BASE_URL}/api/sse?sessionToken=${encodeURIComponent(sessionToken)}`;
    console.log('📡 Connecting to:', sseUrl);
    
    const eventSource = new EventSource(sseUrl);
    let connectionEstablished = false;

    eventSource.onopen = () => {
      console.log('✅ SSE connection established!');
      connectionEstablished = true;
      
      // Keep connection open for a few seconds to test
      setTimeout(() => {
        console.log('🔌 Closing SSE connection...');
        eventSource.close();
        resolve('SSE test successful');
      }, 3000);
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error);
      if (!connectionEstablished) {
        reject(new Error('SSE connection failed'));
      }
    };

    eventSource.onmessage = (event) => {
      console.log('📨 SSE message received:', event.data);
    };

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!connectionEstablished) {
        console.log('❌ SSE connection timeout');
        eventSource.close();
        reject(new Error('SSE connection timeout'));
      }
    }, 10000);
  });
}

// Run the test
loginAndTestSSE()
  .then(result => {
    console.log('🎉', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });
