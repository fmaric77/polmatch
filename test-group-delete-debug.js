// Test script to debug group message delete API endpoints
console.log('Testing group message delete endpoints...');

async function testGroupMessageDelete() {
  try {
    // Step 1: Login
    console.log('1. Logging in...');
    const loginRes = await fetch('http://localhost:3001/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    const loginData = await loginRes.json();
    console.log('Login response:', loginData);
    
    if (!loginData.success) {
      throw new Error('Login failed');
    }
    
    const sessionCookie = loginRes.headers.get('set-cookie');
    console.log('Session cookie:', sessionCookie);
    
    // Step 2: Get available groups
    console.log('2. Fetching groups...');
    const groupsRes = await fetch('http://localhost:3001/api/groups/list', {
      headers: {
        'Cookie': sessionCookie || ''
      }
    });
    
    const groupsData = await groupsRes.json();
    console.log('Groups response:', groupsData);
    
    if (!groupsData.success || !groupsData.groups || groupsData.groups.length === 0) {
      throw new Error('No groups found');
    }
    
    const testGroup = groupsData.groups[0];
    console.log('Using test group:', testGroup);
    
    // Step 3: Get group messages
    console.log('3. Fetching group messages...');
    const messagesRes = await fetch(`http://localhost:3001/api/groups/${testGroup.group_id}/messages`, {
      headers: {
        'Cookie': sessionCookie || ''
      }
    });
    
    const messagesData = await messagesRes.json();
    console.log('Messages response:', messagesData);
    
    if (!messagesData.success || !messagesData.messages || messagesData.messages.length === 0) {
      console.log('No messages found, sending a test message first...');
      
      // Send a test message
      const sendRes = await fetch(`http://localhost:3001/api/groups/${testGroup.group_id}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie || ''
        },
        body: JSON.stringify({
          content: 'Test message for deletion',
          attachments: []
        })
      });
      
      const sendData = await sendRes.json();
      console.log('Send message response:', sendData);
      
      if (!sendData.success) {
        throw new Error('Failed to send test message');
      }
      
      // Fetch messages again
      const messagesRes2 = await fetch(`http://localhost:3001/api/groups/${testGroup.group_id}/messages`, {
        headers: {
          'Cookie': sessionCookie || ''
        }
      });
      
      const messagesData2 = await messagesRes2.json();
      console.log('Messages after sending:', messagesData2);
      
      if (!messagesData2.success || !messagesData2.messages || messagesData2.messages.length === 0) {
        throw new Error('Still no messages found after sending');
      }
      
      messagesData.messages = messagesData2.messages;
    }
    
    // Step 4: Test different delete endpoint URLs
    const testMessage = messagesData.messages.find(msg => msg.sender_id === loginData.user.user_id);
    if (!testMessage) {
      throw new Error('No messages from current user found to delete');
    }
    
    console.log('4. Testing delete endpoints for message:', testMessage.message_id);
    
    // Test the exact URLs that the frontend is using
    const deleteUrls = [
      `http://localhost:3001/api/groups/${testGroup.group_id}/messages`,
      `http://localhost:3001/api/groups/${testGroup.group_id}/channels/general/messages`
    ];
    
    for (const deleteUrl of deleteUrls) {
      console.log(`Testing DELETE to: ${deleteUrl}`);
      
      const deleteRes = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie || ''
        },
        body: JSON.stringify({
          message_id: testMessage.message_id
        })
      });
      
      console.log(`Response status: ${deleteRes.status} ${deleteRes.statusText}`);
      
      if (deleteRes.status === 404) {
        console.log('❌ 404 - Endpoint not found');
        continue;
      }
      
      const deleteData = await deleteRes.json();
      console.log('Delete response:', deleteData);
      
      if (deleteData.success) {
        console.log('✅ Delete successful!');
        break;
      } else {
        console.log('❌ Delete failed:', deleteData);
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testGroupMessageDelete();