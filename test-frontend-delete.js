const fetch = require('node-fetch');

async function testFrontendDeleteFlow() {
  const BASE_URL = 'http://localhost:3002';
  
  try {
    console.log('🔵 Testing frontend-style delete flow...\n');
    
    // Step 1: Login to get session cookies (like frontend would)
    console.log('1. Logging in with sokol@example.com...');
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    const loginData = await loginResponse.text();
    console.log(`   Login response: ${loginResponse.status} - ${loginData}`);
    
    // Extract cookies from login response
    const cookies = loginResponse.headers.get('set-cookie');
    console.log(`   Cookies received: ${cookies ? 'Yes' : 'No'}`);
    
    if (!cookies) {
      console.log('❌ No cookies received from login');
      return;
    }
    
    // Step 2: Get user groups to find a valid group and channel
    console.log('\n2. Fetching user groups...');
    const groupsResponse = await fetch(`${BASE_URL}/api/groups/list`, {
      headers: {
        'Cookie': cookies
      }
    });
    
    console.log(`   Groups response: ${groupsResponse.status}`);
    const groupsText = await groupsResponse.text();
    console.log(`   Groups raw response: ${groupsText.substring(0, 200)}...`);
    
    let groupsData;
    try {
      groupsData = JSON.parse(groupsText);
    } catch (e) {
      console.log(`❌ Failed to parse groups response as JSON: ${e.message}`);
      return;
    }
    
    console.log(`   Groups found: ${groupsData.groups ? groupsData.groups.length : 0}`);
    
    if (!groupsData.success || !groupsData.groups || groupsData.groups.length === 0) {
      console.log('❌ No groups found');
      return;
    }
    
    const group = groupsData.groups[0];
    console.log(`   Using group: ${group.group_id} (${group.name})`);
    
    // Step 3: Get channels for the group
    console.log('\n3. Fetching group channels...');
    const channelsResponse = await fetch(`${BASE_URL}/api/groups/${group.group_id}/channels`, {
      headers: {
        'Cookie': cookies
      }
    });
    
    console.log(`   Channels response: ${channelsResponse.status}`);
    const channelsText = await channelsResponse.text();
    console.log(`   Channels raw response: ${channelsText.substring(0, 200)}...`);
    
    let channelsData;
    try {
      channelsData = JSON.parse(channelsText);
    } catch (e) {
      console.log(`❌ Failed to parse channels response as JSON: ${e.message}`);
      return;
    }
    
    console.log(`   Channels found: ${channelsData.length || 0}`);
    
    if (!channelsData || channelsData.length === 0) {
      console.log('ℹ️  No channels found, creating a test channel...');
      
      // Create a test channel
      const createChannelResponse = await fetch(`${BASE_URL}/api/groups/${group.group_id}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies
        },
        body: JSON.stringify({
          name: 'test-channel',
          description: 'Test channel for message deletion'
        })
      });
      
      const createChannelData = await createChannelResponse.json();
      console.log(`   Create channel response: ${createChannelResponse.status}`);
      
      if (createChannelResponse.status !== 200) {
        console.log(`❌ Failed to create test channel: ${JSON.stringify(createChannelData)}`);
        return;
      }
      
      channelsData = [createChannelData];
      console.log(`   Created channel: ${createChannelData.channel_id}`);
    }
    
    const channel = channelsData[0];
    console.log(`   Using channel: ${channel.channel_id} (${channel.name})`);
    
    // Step 4: Get messages from the channel
    console.log('\n4. Fetching channel messages...');
    const messagesResponse = await fetch(`${BASE_URL}/api/groups/${group.group_id}/channels/${channel.channel_id}/messages`, {
      headers: {
        'Cookie': cookies
      }
    });
    
    const messagesData = await messagesResponse.json();
    console.log(`   Messages response: ${messagesResponse.status}`);
    console.log(`   Messages found: ${messagesData.length || 0}`);
    
    if (!messagesData || messagesData.length === 0) {
      console.log('ℹ️  No messages found to delete');
      
      // Step 5: Create a test message first
      console.log('\n5. Creating a test message...');
      const createResponse = await fetch(`${BASE_URL}/api/groups/${group.group_id}/channels/${channel.channel_id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookies
        },
        body: JSON.stringify({
          content: 'Test message for deletion - ' + new Date().toISOString()
        })
      });
      
      const createData = await createResponse.json();
      console.log(`   Create response: ${createResponse.status}`);
      
      if (createResponse.status !== 200) {
        console.log(`❌ Failed to create test message: ${JSON.stringify(createData)}`);
        return;
      }
      
      console.log(`   Created message: ${createData._id}`);
      var messageToDelete = createData;
    } else {
      var messageToDelete = messagesData[messagesData.length - 1]; // Use last message
      console.log(`   Using existing message: ${messageToDelete._id}`);
    }
    
    // Step 6: Attempt to delete the message (simulating frontend)
    console.log('\n6. Attempting to delete message...');
    console.log(`   DELETE URL: ${BASE_URL}/api/groups/${group.group_id}/channels/${channel.channel_id}/messages`);
    console.log(`   Message ID: ${messageToDelete._id}`);
    
    const deleteResponse = await fetch(`${BASE_URL}/api/groups/${group.group_id}/channels/${channel.channel_id}/messages`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({
        messageId: messageToDelete._id
      })
    });
    
    const deleteData = await deleteResponse.text();
    console.log(`   Delete response: ${deleteResponse.status}`);
    console.log(`   Delete body: ${deleteData}`);
    
    if (deleteResponse.status === 200) {
      console.log('✅ Message deleted successfully!');
    } else {
      console.log(`❌ Delete failed: ${deleteResponse.status} - ${deleteData}`);
      
      // Additional debugging
      console.log('\n🔍 Additional debugging info:');
      console.log(`   Request URL: ${BASE_URL}/api/groups/${group.group_id}/channels/${channel.channel_id}/messages`);
      console.log(`   Request method: DELETE`);
      console.log(`   Request body: ${JSON.stringify({ messageId: messageToDelete._id })}`);
      console.log(`   Response headers:`, Object.fromEntries(deleteResponse.headers.entries()));
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('   Stack:', error.stack);
  }
}

testFrontendDeleteFlow();
