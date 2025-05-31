// Test SSE connection directly
const fetch = require('node-fetch');

async function testSSE() {
  try {
    // First, let's try to get a session token by logging in
    console.log('Testing SSE connection...');
    
    // Login first
    const loginResponse = await fetch('http://localhost:3000/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (!loginData.success) {
      console.error('Login failed:', loginData.message);
      return;
    }
    
    // Extract session token from Set-Cookie header
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    console.log('Set-Cookie header:', setCookieHeader);
    
    if (!setCookieHeader) {
      console.error('No session cookie received');
      return;
    }
    
    // Parse session token
    const sessionMatch = setCookieHeader.match(/session=([^;]+)/);
    if (!sessionMatch) {
      console.error('Could not extract session token');
      return;
    }
    
    const sessionToken = sessionMatch[1];
    console.log('Extracted session token:', sessionToken.substring(0, 10) + '...');
    
    // Now test SSE connection
    const sseUrl = `http://localhost:3000/api/sse?sessionToken=${encodeURIComponent(sessionToken)}`;
    console.log('Testing SSE URL:', sseUrl);
    
    const sseResponse = await fetch(sseUrl);
    console.log('SSE response status:', sseResponse.status);
    console.log('SSE response headers:', Object.fromEntries(sseResponse.headers.entries()));
    
    if (sseResponse.status !== 200) {
      const errorText = await sseResponse.text();
      console.error('SSE connection failed:', errorText);
      return;
    }
    
    console.log('SSE connection established successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSSE();
