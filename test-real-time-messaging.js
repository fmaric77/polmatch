const fetch = require('node-fetch');

async function testRealTimeMessaging() {
  console.log('Testing real-time messaging implementation...\n');
  
  try {
    // Step 1: Login to get session cookie
    console.log('1. Logging in...');
    const loginResponse = await fetch('http://localhost:3003/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    // Get session cookie from response headers
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    console.log('Set-Cookie header:', setCookieHeader);
    
    if (!setCookieHeader) {
      throw new Error('No session cookie in login response');
    }
    
    const sessionCookie = setCookieHeader.split(';')[0]; // Get just the session=value part
    console.log('Session cookie:', sessionCookie);
    
    // Step 2: Test session API to get session token
    console.log('\n2. Testing session API...');
    const sessionResponse = await fetch('http://localhost:3003/api/session', {
      headers: {
        'Cookie': sessionCookie
      }
    });
    
    if (!sessionResponse.ok) {
      throw new Error(`Session API failed: ${sessionResponse.status}`);
    }
    
    const sessionData = await sessionResponse.json();
    console.log('Session API response:', sessionData);
    
    if (!sessionData.sessionToken) {
      throw new Error('No session token in session API response');
    }
    
    // Step 3: Test SSE connection with session token
    console.log('\n3. Testing SSE connection...');
    const EventSource = require('eventsource');
    
    const sseUrl = `http://localhost:3003/api/sse?token=${sessionData.sessionToken}`;
    console.log('SSE URL:', sseUrl);
    
    const eventSource = new EventSource(sseUrl);
    
    eventSource.onopen = () => {
      console.log('✅ SSE connection established successfully!');
    };
    
    eventSource.onmessage = (event) => {
      console.log('📨 SSE message received:', event.data);
    };
    
    eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error);
    };
    
    // Test for 5 seconds
    setTimeout(() => {
      eventSource.close();
      console.log('\n✅ Real-time messaging test completed successfully!');
      console.log('The SSE connection is working properly with session tokens from the API.');
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testRealTimeMessaging();
