const fetch = require('node-fetch');

async function debugMessageStructure() {
  const BASE_URL = 'http://localhost:3002';
  
  try {
    console.log('🔍 Debugging message structure...\n');
    
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
    console.log(`Login status: ${loginResponse.status}`);
    
    if (loginResponse.status !== 200) {
      console.log('❌ Login failed');
      return;
    }
    
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
    console.log('Channels response:', JSON.stringify(channelsData, null, 2).substring(0, 300));
    
    const channel = Array.isArray(channelsData) ? channelsData[0] : 
                   (channelsData.channels ? channelsData.channels[0] : channelsData);
    
    console.log(`Using group: ${group.group_id}`);
    console.log(`Using channel: ${channel.channel_id}`);
    
    // Get existing messages to see their structure
    const messagesResponse = await fetch(`${BASE_URL}/api/groups/${group.group_id}/channels/${channel.channel_id}/messages`, {
      headers: { 'Cookie': cookies }
    });
    
    const messagesData = await messagesResponse.json();
    console.log(`\nMessages response status: ${messagesResponse.status}`);
    
    if (messagesData && messagesData.messages && messagesData.messages.length > 0) {
      const message = messagesData.messages[0];
      console.log('\n📧 Sample message structure:');
      console.log('Message keys:', Object.keys(message));
      console.log('Message _id:', message._id);
      console.log('Message message_id:', message.message_id);
      console.log('Message sender_id:', message.sender_id);
      console.log('Message content preview:', message.content ? message.content.substring(0, 50) + '...' : 'No content');
      
      // Try to delete using the actual structure we found
      console.log('\n🗑️  Attempting delete with message_id:', message.message_id);
      
      const deleteResponse = await fetch(`${BASE_URL}/api/groups/${group.group_id}/channels/${channel.channel_id}/messages`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies
        },
        body: JSON.stringify({
          message_id: message.message_id  // Use the actual field from the message
        })
      });
      
      const deleteResult = await deleteResponse.text();
      console.log(`Delete response status: ${deleteResponse.status}`);
      console.log(`Delete response body: ${deleteResult}`);
      
      if (deleteResponse.status === 404) {
        console.log('\n❌ Still getting 404! Let\'s try with _id instead...');
        
        const deleteResponse2 = await fetch(`${BASE_URL}/api/groups/${group.group_id}/channels/${channel.channel_id}/messages`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies
          },
          body: JSON.stringify({
            message_id: message._id.toString()  // Try using _id instead
          })
        });
        
        const deleteResult2 = await deleteResponse2.text();
        console.log(`Delete with _id status: ${deleteResponse2.status}`);
        console.log(`Delete with _id body: ${deleteResult2}`);
      }
      
    } else {
      console.log('❌ No messages found to analyze');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugMessageStructure();
