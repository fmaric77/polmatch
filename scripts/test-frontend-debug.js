const fetch = require('node-fetch');

async function testFrontendDebug() {
  try {
    console.log('🔍 Frontend Debug Test - Testing API responses that frontend consumes');
    
    // First login
    console.log('\n1. Testing login API...');
    const loginResponse = await fetch('http://localhost:3001/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response status:', loginResponse.status);
    console.log('Login response data:', JSON.stringify(loginData, null, 2));
    
    if (!loginData.success) {
      console.error('❌ Login failed');
      return;
    }
    
    // Get session cookies from response
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Set-Cookie header:', cookies);
    
    if (!cookies) {
      console.error('❌ No cookies in login response');
      return;
    }
    
    // Extract session token
    const sessionMatch = cookies.match(/session=([^;]+)/);
    const sessionToken = sessionMatch ? sessionMatch[1] : null;
    
    if (!sessionToken) {
      console.error('❌ No session token found');
      return;
    }
    
    console.log('✅ Got session token:', sessionToken.substring(0, 20) + '...');
    
    const headers = {
      'Content-Type': 'application/json',
      'Cookie': `session=${sessionToken}`
    };
    
    // Test session API
    console.log('\n2. Testing session API...');
    const sessionResponse = await fetch('http://localhost:3001/api/session', { headers });
    const sessionData = await sessionResponse.json();
    console.log('Session response status:', sessionResponse.status);
    console.log('Session data:', JSON.stringify(sessionData, null, 2));
    
    // Test private conversations API
    console.log('\n3. Testing private conversations API...');
    const privateConversationsResponse = await fetch('http://localhost:3001/api/private-conversations', { headers });
    const privateConversationsData = await privateConversationsResponse.json();
    console.log('Private conversations response status:', privateConversationsResponse.status);
    console.log('Private conversations data:', JSON.stringify(privateConversationsData, null, 2));
    
    // Test messages API
    console.log('\n4. Testing messages API...');
    const messagesResponse = await fetch('http://localhost:3001/api/messages', { headers });
    const messagesData = await messagesResponse.json();
    console.log('Messages response status:', messagesResponse.status);
    console.log('Messages data:', JSON.stringify(messagesData, null, 2));
    
    // Test groups list API
    console.log('\n5. Testing groups list API...');
    const groupsResponse = await fetch('http://localhost:3001/api/groups/list', { headers });
    const groupsData = await groupsResponse.json();
    console.log('Groups response status:', groupsResponse.status);
    console.log('Groups data:', JSON.stringify(groupsData, null, 2));
    
    console.log('\n✅ Frontend debug test completed');
    
  } catch (error) {
    console.error('❌ Frontend debug test failed:', error);
  }
}

testFrontendDebug();
