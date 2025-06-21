// Test script to verify group message display names
const baseUrl = 'http://localhost:3000';

const testGroupMessageDisplayNames = async () => {
  console.log('🔍 Testing group message display names...');
  
  try {
    // Login first
    console.log('🔐 Logging in...');
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    const loginData = await loginRes.json();
    if (!loginData.success) {
      console.error('❌ Login failed:', loginData.message);
      return;
    }
    
    // Extract session cookie from response headers
    const setCookieHeader = loginRes.headers.get('set-cookie');
    const sessionCookie = setCookieHeader ? setCookieHeader.split(';')[0] : '';
    console.log('✅ Login successful, session:', sessionCookie.substring(0, 20) + '...');
    
    // Test different profile types
    const profileTypes = ['basic', 'love', 'business'];
    
    for (const profileType of profileTypes) {
      console.log(`\n🔍 Testing ${profileType} profile groups...`);
      
      // Get groups for this profile type
      const groupsRes = await fetch(`${baseUrl}/api/groups/list?profile_type=${profileType}`, {
        headers: { 'Cookie': sessionCookie }
      });
      
      const groupsData = await groupsRes.json();
      if (!groupsData.success) {
        console.log(`❌ Failed to get groups for ${profileType}:`, groupsData.error);
        continue;
      }
      
      console.log(`📋 Found ${groupsData.groups.length} groups for ${profileType}`);
      
      if (groupsData.groups.length > 0) {
        for (const group of groupsData.groups.slice(0, 3)) { // Test first 3 groups
          console.log(`\n🏢 Testing group: ${group.name} (ID: ${group.group_id})`);
          
          // First try to get channels for this group
          const channelsRes = await fetch(`${baseUrl}/api/groups/${group.group_id}/channels?profile_type=${profileType}`, {
            headers: { 'Cookie': sessionCookie }
          });
          
          const channelsData = await channelsRes.json();
          if (channelsData.success && channelsData.channels.length > 0) {
            const firstChannel = channelsData.channels[0];
            console.log(`📺 Found channel: ${firstChannel.name} (ID: ${firstChannel.channel_id})`);
            
            // Get group messages from this channel
            const messagesRes = await fetch(`${baseUrl}/api/groups/${group.group_id}/messages?profile_type=${profileType}&channel_id=${firstChannel.channel_id}&limit=5`, {
              headers: { 'Cookie': sessionCookie }
            });
            
            const messagesData = await messagesRes.json();
            if (messagesData.success && messagesData.messages.length > 0) {
              console.log(`💬 Recent messages (${messagesData.messages.length}):`);
              messagesData.messages.forEach((msg, index) => {
                console.log(`\n  Message ${index + 1}:`);
                console.log(`    Sender ID: ${msg.sender_id}`);
                console.log(`    Sender Username: ${msg.sender_username}`);
                console.log(`    Sender Display Name: ${msg.sender_display_name || 'NOT SET'}`);
                console.log(`    Content: ${msg.content.substring(0, 50)}...`);
                console.log(`    Profile Type: ${messagesData.profile_type}`);
              });
              
              // Found messages, no need to test further
              break;
            } else {
              console.log(`💬 No messages found in group ${group.name} channel ${firstChannel.name}`);
              
              // Try sending a test message
              console.log(`📤 Sending test message to verify display names...`);
              const testMessage = `Test message for display name verification - ${Date.now()}`;
              
              const sendRes = await fetch(`${baseUrl}/api/groups/${group.group_id}/messages`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Cookie': sessionCookie
                },
                body: JSON.stringify({
                  content: testMessage,
                  channel_id: firstChannel.channel_id,
                  profile_type: profileType
                })
              });
              
              const sendData = await sendRes.json();
              if (sendData.success) {
                console.log(`✅ Test message sent successfully`);
                
                // Wait a moment and fetch messages again to see the new message
                setTimeout(async () => {
                  const newMessagesRes = await fetch(`${baseUrl}/api/groups/${group.group_id}/messages?profile_type=${profileType}&channel_id=${firstChannel.channel_id}&limit=3`, {
                    headers: { 'Cookie': sessionCookie }
                  });
                  
                  const newMessagesData = await newMessagesRes.json();
                  if (newMessagesData.success) {
                    console.log(`\n📨 Messages after sending test message:`);
                    newMessagesData.messages.filter(msg => msg.content.includes('Test message for display name verification')).forEach((msg, index) => {
                      console.log(`\n  New Message:`);
                      console.log(`    Sender ID: ${msg.sender_id}`);
                      console.log(`    Sender Username: ${msg.sender_username}`);
                      console.log(`    Sender Display Name: ${msg.sender_display_name || 'NOT SET'}`);
                      console.log(`    Content: ${msg.content}`);
                    });
                  }
                }, 2000);
                break; // Stop after successful send
              } else {
                console.log(`❌ Failed to send test message:`, sendData.error);
              }
            }
          } else {
            console.log(`❌ No channels found for group ${group.name}`);
          }
        }
      } else {
        console.log(`❌ No groups found for ${profileType}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing group message display names:', error);
  }
};

// Run the test
testGroupMessageDisplayNames();
