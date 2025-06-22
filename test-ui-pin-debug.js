const fetch = require('node-fetch');

async function testUIPin() {
  const BASE_URL = 'http://localhost:3001';
  
  try {
    // Login
    console.log('🔐 Logging in...');
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sokol@example.com', password: 'mango' })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Login failed:', loginResponse.status);
      return;
    }
    
    const sessionCookie = loginResponse.headers.get('set-cookie');
    console.log('✅ Login successful');
    
    // Test the known group and channel
    const groupId = '157e711f-fa91-4e13-a6ca-ebaf79ece6bc';
    const channelId = '6c986c9a-0aef-463d-9622-d86775e117d0';
    
    // Get messages to find one to pin
    console.log('📨 Fetching messages...');
    const messagesResponse = await fetch(`${BASE_URL}/api/groups/${groupId}/channels/${channelId}/messages?profile_type=basic&limit=5`, {
      headers: { 'Cookie': sessionCookie }
    });
    
    const messagesData = await messagesResponse.json();
    if (!messagesData.success || messagesData.messages.length === 0) {
      console.log('❌ No messages found');
      return;
    }
    
    const testMessage = messagesData.messages.find(msg => !msg.is_pinned);
    if (!testMessage) {
      console.log('❌ No unpinned messages found');
      return;
    }
    
    console.log(`📧 Found message to pin: ${testMessage.message_id}`);
    console.log(`📧 Content: ${testMessage.content.substring(0, 50)}...`);
    console.log(`📧 Is pinned: ${testMessage.is_pinned}`);
    
    // Test pinning via the same endpoint the UI uses
    console.log('\\n📌 Testing pin via UI endpoint...');
    const pinResponse = await fetch(`${BASE_URL}/api/groups/${groupId}/pin`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': sessionCookie 
      },
      body: JSON.stringify({
        message_id: testMessage.message_id,
        channel_id: channelId
      })
    });
    
    console.log(`Pin response status: ${pinResponse.status}`);
    const pinResponseText = await pinResponse.text();
    console.log('Pin response body:', pinResponseText);
    
    if (pinResponse.ok) {
      console.log('✅ Pin request successful!');
      
      // Check if message shows as pinned
      console.log('\\n🔄 Checking pinned messages...');
      const pinnedResponse = await fetch(`${BASE_URL}/api/groups/${groupId}/pinned?profile_type=basic`, {
        headers: { 'Cookie': sessionCookie }
      });
      
      const pinnedData = await pinnedResponse.json();
      console.log('Pinned messages:', JSON.stringify(pinnedData, null, 2));
      
    } else {
      console.log('❌ Pin request failed');
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testUIPin();
