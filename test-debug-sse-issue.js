// Debug SSE connection issue
const { EventSource } = require('eventsource');

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

async function testUser(email, password, name) {
  console.log(`\n=== Testing ${name} (${email}) ===`);
  
  const cookieJar = new CookieJar();

  // 1. Login
  console.log('1. Logging in...');
  const loginResponse = await makeRequest(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!loginResponse.ok) {
    console.error(`❌ Login failed: ${loginResponse.status}`);
    return false;
  }

  const setCookies = loginResponse.headers.raw()['set-cookie'];
  if (setCookies) {
    setCookies.forEach(cookie => cookieJar.addCookie(cookie));
  }

  const loginData = await loginResponse.json();
  console.log(`✅ Login successful: ${loginData.user.username}`);

  // 2. Get session token from cookies
  const sessionTokenFromCookie = cookieJar.getSessionToken();
  console.log(`🍪 Session token from cookie: ${sessionTokenFromCookie ? sessionTokenFromCookie.substring(0, 10) + '...' : 'NOT FOUND'}`);

  // 3. Test session endpoint
  console.log('2. Testing session endpoint...');
  const sessionResponse = await makeRequest(`${BASE_URL}/api/session`, {
    headers: {
      'Cookie': cookieJar.getCookieHeader()
    }
  });

  if (!sessionResponse.ok) {
    console.error(`❌ Session failed: ${sessionResponse.status}`);
    return false;
  }

  const sessionData = await sessionResponse.json();
  console.log(`✅ Session valid: ${sessionData.user.username}`);
  console.log(`🔑 Session token from API: ${sessionData.sessionToken ? sessionData.sessionToken.substring(0, 10) + '...' : 'NOT FOUND'}`);

  // 4. Test SSE connection
  console.log('3. Testing SSE connection...');
  
  return new Promise((resolve) => {
    const sseUrl = `${BASE_URL}/api/sse?sessionToken=${encodeURIComponent(sessionData.sessionToken)}`;
    console.log(`📡 SSE URL: ${sseUrl.substring(0, 50)}...`);
    
    const eventSource = new EventSource(sseUrl);
    let connectionEstablished = false;

    const timeout = setTimeout(() => {
      if (!connectionEstablished) {
        console.log(`❌ ${name}: SSE connection timeout`);
        eventSource.close();
        resolve(false);
      }
    }, 10000);

    eventSource.onopen = () => {
      console.log(`✅ ${name}: SSE connection opened`);
    };

    eventSource.onerror = (error) => {
      console.error(`❌ ${name}: SSE error:`, error.message || error);
      if (!connectionEstablished) {
        clearTimeout(timeout);
        eventSource.close();
        resolve(false);
      }
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`📨 ${name}: Received SSE message:`, data.type);
        
        if (data.type === 'CONNECTION_ESTABLISHED') {
          connectionEstablished = true;
          console.log(`✅ ${name}: SSE connection fully established!`);
          clearTimeout(timeout);
          
          // Keep connection open for a moment
          setTimeout(() => {
            eventSource.close();
            resolve(true);
          }, 2000);
        }
      } catch (e) {
        console.log(`📨 ${name}: Raw SSE:`, event.data);
      }
    };
  });
}

async function runTest() {
  console.log('🔧 Debugging SSE connection issue...\n');

  // Test both users
  const user1Success = await testUser('sokol@example.com', 'mango', 'User1 (sokol)');
  const user2Success = await testUser('m@m', 'm', 'User2 (m)');

  console.log('\n=== SUMMARY ===');
  console.log(`User1 (sokol): ${user1Success ? '✅ SSE Working' : '❌ SSE Failed'}`);
  console.log(`User2 (m): ${user2Success ? '✅ SSE Working' : '❌ SSE Failed'}`);

  if (!user1Success || !user2Success) {
    console.log('\n⚠️ Some users cannot establish SSE connections!');
    console.log('This explains why real-time messaging only works one way.');
  } else {
    console.log('\n✅ Both users can establish SSE connections.');
    console.log('The issue might be in the frontend component logic.');
  }
}

runTest()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  });
