const EventSource = require('eventsource');
const fetch = require('node-fetch');

async function testSSEConnectionTracking() {
  console.log('🔍 Testing SSE connection tracking...');
  
  try {
    // Login first
    console.log('1. Logging in...');
    const loginRes = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sokol@example.com', password: 'mango' })
    });
    
    if (!loginRes.ok) {
      console.error('❌ Login failed:', loginRes.status);
      return;
    }
    
    const sessionCookie = loginRes.headers.get('set-cookie');
    const sessionToken = sessionCookie?.split('session=')[1]?.split(';')[0];
    console.log('✅ Logged in successfully');
    
    // Connect to SSE
    console.log('\n2. Connecting to SSE...');
    const eventSource = new EventSource(`http://localhost:3000/api/sse?sessionToken=${sessionToken}`);
    
    let connectionEstablished = false;
    
    eventSource.onopen = () => {
      console.log('✅ SSE connection opened');
    };
    
    eventSource.onmessage = (event) => {
      console.log('📨 SSE message received:', event.data);
      
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'CONNECTION_ESTABLISHED') {
          console.log('🔗 Connection established for user:', message.data.userId);
          connectionEstablished = true;
          
          // Now test sending a message after connection is established
          setTimeout(testMessageSending, 2000);
        } else if (message.type === 'NEW_MESSAGE') {
          console.log('🎉 NEW_MESSAGE received! Real-time messaging is working!');
          console.log('📝 Message content:', message.data.content);
        }
      } catch (e) {
        console.log('📨 Raw SSE event:', event.data);
      }
    };
    
    eventSource.onerror = (error) => {
      console.log('❌ SSE error:', error.message);
    };
    
    async function testMessageSending() {
      console.log('\n3. Testing message sending...');
      
      // Get a user to send to
      const usersRes = await fetch('http://localhost:3000/api/admin/users', {
        headers: { Cookie: sessionCookie }
      });
      
      if (!usersRes.ok) {
        console.error('❌ Failed to get users:', usersRes.status);
        return;
      }
      
      const usersData = await usersRes.json();
      const otherUser = usersData.users?.find(u => u.email !== 'sokol@example.com');
      
      if (!otherUser) {
        console.log('❌ No other user found to test messaging with');
        return;
      }
      
      console.log('📤 Sending message to:', otherUser.username);
      
      const messageRes = await fetch('http://localhost:3000/api/messages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Cookie: sessionCookie 
        },
        body: JSON.stringify({
          receiver_id: otherUser.user_id,
          content: 'SSE Connection Test Message - ' + Date.now()
        })
      });
      
      const messageData = await messageRes.json();
      console.log('📤 Message sending result:', messageData.success ? 'SUCCESS' : 'FAILED');
      
      if (!messageData.success) {
        console.error('❌ Message send error:', messageData);
      }
    }
    
    // Close connection after 10 seconds
    setTimeout(() => {
      console.log('\n🏁 Test completed');
      eventSource.close();
      process.exit(0);
    }, 10000);
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testSSEConnectionTracking().catch(console.error);
