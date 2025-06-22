const fetch = require('node-fetch');

async function testPinMessageUI() {
  const BASE_URL = 'http://localhost:3000';
  
  try {
    // 1. Login to get session
    console.log('🔐 Logging in...');
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });

    if (!loginResponse.ok) {
      console.log('❌ Login failed');
      return;
    }

    const sessionCookie = loginResponse.headers.get('set-cookie');
    console.log('✅ Login successful');

    // 2. Use the known group where sokol is owner
    const testGroup = {
      group_id: '157e711f-fa91-4e13-a6ca-ebaf79ece6bc',
      name: 'adaw'
    };
    console.log(`📁 Using known owned group: ${testGroup.name} (${testGroup.group_id})`);
    
    // 3. Get channels for this group
    const channelsResponse = await fetch(`${BASE_URL}/api/groups/${testGroup.group_id}/channels?profile_type=basic`, {
      headers: { 'Cookie': sessionCookie }
    });
    
    const channelsData = await channelsResponse.json();
    if (!channelsData.success || channelsData.channels.length === 0) {
      console.log('❌ No channels found');
      return;
    }
    
    const channel = channelsData.channels[0];
    console.log(`📺 Using channel: ${channel.name} (${channel.channel_id})`);
    
    // 4. Get messages from this channel
    const messagesResponse = await fetch(`${BASE_URL}/api/groups/${testGroup.group_id}/channels/${channel.channel_id}/messages?profile_type=basic&limit=5`, {
      headers: { 'Cookie': sessionCookie }
    });
    
    const messagesData = await messagesResponse.json();
    if (!messagesData.success || messagesData.messages.length === 0) {
      console.log('❌ No messages found in channel');
      return;
    }
    
    const testMessage = messagesData.messages[0];
    console.log(`📧 Using message: ${testMessage.message_id}`);
    console.log(`📧 Content: ${testMessage.content.substring(0, 50)}...`);
    console.log(`📧 Is pinned: ${testMessage.is_pinned}`);
    
    // 5. Test pinning the message
    console.log('\\n📌 Testing pin message API...');
    const pinResponse = await fetch(`${BASE_URL}/api/groups/${testGroup.group_id}/pin`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': sessionCookie 
      },
      body: JSON.stringify({
        message_id: testMessage.message_id,
        channel_id: channel.channel_id
      })
    });
    
    console.log(`Pin response status: ${pinResponse.status}`);
    const pinData = await pinResponse.json();
    console.log('Pin response:', JSON.stringify(pinData, null, 2));
    
    if (pinResponse.ok && pinData.success) {
      console.log('✅ Message pinned successfully!');
      
      // 6. Fetch messages again to see if pinned status is reflected
      console.log('\\n🔄 Fetching messages again to check pinned status...');
      const messagesResponse2 = await fetch(`${BASE_URL}/api/groups/${testGroup.group_id}/channels/${channel.channel_id}/messages?profile_type=basic&limit=5`, {
        headers: { 'Cookie': sessionCookie }
      });
      
      const messagesData2 = await messagesResponse2.json();
      const updatedMessage = messagesData2.messages.find(m => m.message_id === testMessage.message_id);
      
      if (updatedMessage) {
        console.log(`📧 Updated message is_pinned: ${updatedMessage.is_pinned}`);
        console.log(`📧 Updated message pinned_at: ${updatedMessage.pinned_at}`);
        console.log(`📧 Updated message pinned_by: ${updatedMessage.pinned_by}`);
      }
      
      // 7. Test unpinning
      console.log('\\n📌 Testing unpin message API...');
      const unpinResponse = await fetch(`${BASE_URL}/api/groups/${testGroup.group_id}/pin`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie 
        },
        body: JSON.stringify({
          message_id: testMessage.message_id,
          channel_id: channel.channel_id
        })
      });
      
      console.log(`Unpin response status: ${unpinResponse.status}`);
      const unpinData = await unpinResponse.json();
      console.log('Unpin response:', JSON.stringify(unpinData, null, 2));
      
    } else {
      console.log('❌ Failed to pin message:', pinData);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

testPinMessageUI();
