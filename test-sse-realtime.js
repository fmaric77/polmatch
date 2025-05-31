// Test script to verify SSE connection and real-time messaging
import fetch from 'node-fetch';
import { EventSource } from 'eventsource';

const BASE_URL = 'http://localhost:3000';

async function loginAndGetSession() {
  console.log('Logging in...');
  
  const loginResponse = await fetch(`${BASE_URL}/api/login`, {
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

  const loginData = await loginResponse.json();
  console.log('Login successful:', loginData);

  // Extract cookies from login response
  const cookies = loginResponse.headers.raw()['set-cookie'];
  console.log('Cookies:', cookies);
  
  if (!cookies) {
    throw new Error('No cookies received from login');
  }

  // Extract session token from cookies
  const sessionCookie = cookies.find(cookie => cookie.startsWith('session='));
  if (!sessionCookie) {
    throw new Error('No session cookie found');
  }
  
  const sessionToken = sessionCookie.split('session=')[1].split(';')[0];
  console.log('Session token:', sessionToken);

  // Verify session with cookie
  const sessionResponse = await fetch(`${BASE_URL}/api/session`, {
    headers: {
      'Cookie': `session=${sessionToken}`
    }
  });

  if (!sessionResponse.ok) {
    throw new Error(`Session fetch failed: ${sessionResponse.status}`);
  }

  const sessionData = await sessionResponse.json();
  console.log('Session data:', sessionData);
  
  return sessionToken;
}

async function testSSEConnection(sessionToken) {
  console.log('Testing SSE connection...');
  
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(`${BASE_URL}/api/sse?sessionToken=${sessionToken}`);
    
    eventSource.onopen = () => {
      console.log('✅ SSE connection established!');
      eventSource.close();
      resolve('Connection successful');
    };

    eventSource.onerror = (error) => {
      console.log('❌ SSE connection failed:', error);
      eventSource.close();
      reject(error);
    };

    eventSource.onmessage = (event) => {
      console.log('📨 Received SSE message:', event.data);
    };

    // Close after 5 seconds if no connection
    setTimeout(() => {
      if (eventSource.readyState !== EventSource.OPEN) {
        console.log('❌ SSE connection timeout');
        eventSource.close();
        reject(new Error('Connection timeout'));
      }
    }, 5000);
  });
}

async function main() {
  try {
    const sessionToken = await loginAndGetSession();
    await testSSEConnection(sessionToken);
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
