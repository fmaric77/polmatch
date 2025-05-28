const fetch = require('node-fetch');

async function testExactBrowserScenario() {
  const BASE_URL = 'http://localhost:3002';
  
  try {
    console.log('🎯 Testing exact browser scenario...\n');
    
    // Login
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    const cookies = loginResponse.headers.get('set-cookie');
    
    // Get groups
    const groupsResponse = await fetch(`${BASE_URL}/api/groups/list`, {
      headers: { 'Cookie': cookies }
    });
    const groupsData = await groupsResponse.json();
    const group = groupsData.groups[0];
    
    // Get channels  
    const channelsResponse = await fetch(`${BASE_URL}/api/groups/${group.group_id}/channels`, {
      headers: { 'Cookie': cookies }
    });
    const channelsData = await channelsResponse.json();
    const channel = channelsData.channels[0]; // Note: channels are in a .channels property!
    
    console.log(`Using group: ${group.group_id}`);
    console.log(`Using channel: ${channel.channel_id}`);
    
    // Get messages
    const messagesResponse = await fetch(`${BASE_URL}/api/groups/${group.group_id}/channels/${channel.channel_id}/messages`, {
      headers: { 'Cookie': cookies }
    });
    const messagesData = await messagesResponse.json();
    
    if (messagesData.messages && messagesData.messages.length > 0) {
      const message = messagesData.messages[0];
      console.log(`\n📧 Testing with message:`, {
        _id: message._id,
        message_id: message.message_id,
        content_preview: message.content ? message.content.substring(0, 30) + '...' : 'No content'
      });
      
      // Test 1: What frontend should be sending (using message_id from the message object)
      console.log('\n🧪 Test 1: Frontend-style delete (using message_id)');
      const frontendDeleteResponse = await fetch(`${BASE_URL}/api/groups/${group.group_id}/channels/${channel.channel_id}/messages`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies
        },
        body: JSON.stringify({
          message_id: message.message_id  // This is what frontend sends
        })
      });
      
      const frontendResult = await frontendDeleteResponse.text();
      console.log(`   Response: ${frontendDeleteResponse.status} - ${frontendResult}`);
      
      if (frontendDeleteResponse.status === 404) {
        console.log('\n❌ Frontend-style delete failed with 404!');
        console.log('   This means the issue is likely in the backend logic');
        
        // Let's check if the message still exists
        const recheckResponse = await fetch(`${BASE_URL}/api/groups/${group.group_id}/channels/${channel.channel_id}/messages`, {
          headers: { 'Cookie': cookies }
        });
        const recheckData = await recheckResponse.json();
        const stillExists = recheckData.messages.find(m => m.message_id === message.message_id);
        
        console.log(`   Message still exists in DB: ${stillExists ? 'Yes' : 'No'}`);
        
        if (stillExists) {
          console.log('\n🔍 Let\'s debug the backend DELETE logic...');
          console.log('   Request details that should work:');
          console.log(`   - URL: /api/groups/${group.group_id}/channels/${channel.channel_id}/messages`);
          console.log(`   - Method: DELETE`);
          console.log(`   - Body: {"message_id": "${message.message_id}"}`);
          console.log(`   - Group ID: ${group.group_id}`);
          console.log(`   - Channel ID: ${channel.channel_id}`);
          console.log(`   - Message ID: ${message.message_id}`);
          console.log(`   - Message exists: Yes`);
          console.log(`   - User authenticated: Yes`);
        }
      } else {
        console.log('✅ Frontend-style delete worked!');
      }
      
    } else {
      console.log('❌ No messages found to test with');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testExactBrowserScenario();
