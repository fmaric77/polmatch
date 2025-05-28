async function testDeleteMessageAPI() {
  try {
    console.log('🔬 Testing delete message API functionality...');
    
    // Login as sokol
    console.log('\n1. Logging in as sokol@example.com...');
    const loginRes = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    if (!loginRes.ok) {
      console.error('❌ Login request failed:', loginRes.status, loginRes.statusText);
      return;
    }
    
    const loginData = await loginRes.json();
    if (!loginData.success) {
      console.error('❌ Login failed:', loginData);
      return;
    }
    
    console.log('✅ Login successful! User:', loginData.user.username, '(ID:', loginData.user.user_id + ')');
    
    // Get session cookie
    const sessionCookie = loginRes.headers.get('set-cookie');
    if (!sessionCookie) {
      console.error('❌ No session cookie received');
      return;
    }
    
    console.log('✅ Session cookie received');
    
    // Get list of users to find someone to message
    console.log('\n2. Getting available users...');
    const usersRes = await fetch('http://localhost:3000/api/users/list', {
      headers: { 'Cookie': sessionCookie }
    });
    
    if (!usersRes.ok) {
      console.error('❌ Failed to get users list:', usersRes.status);
      return;
    }
    
    const usersData = await usersRes.json();
    if (!usersData.success || !usersData.users || usersData.users.length === 0) {
      console.error('❌ No users found:', usersData);
      return;
    }
    
    // Find another user to test with
    const otherUser = usersData.users.find(u => u.user_id !== loginData.user.user_id);
    if (!otherUser) {
      console.error('❌ No other user found to test with');
      return;
    }
    
    console.log('✅ Found test user:', otherUser.username, '(ID:', otherUser.user_id + ')');
    
    // Send a test message first
    console.log('\n3. Sending a test message...');
    const testMessageContent = 'TEST DELETE MESSAGE - ' + new Date().toISOString();
    const sendRes = await fetch('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({ 
        receiver_id: otherUser.user_id,
        content: testMessageContent,
        attachments: []
      })
    });
    
    if (!sendRes.ok) {
      console.error('❌ Send message request failed:', sendRes.status);
      return;
    }
    
    const sendData = await sendRes.json();
    if (!sendData.success) {
      console.error('❌ Failed to send test message:', sendData);
      return;
    }
    
    console.log('✅ Test message sent successfully!');
    console.log('   Message content:', testMessageContent);
    
    // Wait a moment then fetch messages
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get messages to find the one we just sent
    console.log('\n4. Fetching messages to find the test message...');
    const messagesRes = await fetch(`http://localhost:3000/api/messages?user_id=${otherUser.user_id}`, {
      headers: { 'Cookie': sessionCookie }
    });
    
    if (!messagesRes.ok) {
      console.error('❌ Failed to fetch messages:', messagesRes.status);
      return;
    }
    
    const messagesData = await messagesRes.json();
    if (!messagesData.success) {
      console.error('❌ Messages API failed:', messagesData);
      return;
    }
    
    console.log('✅ Messages fetched successfully!');
    console.log('   Total messages:', messagesData.messages?.length || 0);
    
    if (!messagesData.messages || messagesData.messages.length === 0) {
      console.error('❌ No messages found after sending test message');
      return;
    }
    
    // Find the message we just sent
    const testMessage = messagesData.messages.find(msg => 
      msg.content === testMessageContent && msg.sender_id === loginData.user.user_id
    );
    
    if (!testMessage) {
      console.error('❌ Could not find the test message we just sent');
      console.log('   Available messages:', messagesData.messages.map(m => ({
        id: m._id,
        sender: m.sender_id,
        content: m.content?.substring(0, 50) + '...'
      })));
      return;
    }
    
    console.log('✅ Found test message to delete!');
    console.log('   Message ID:', testMessage._id);
    console.log('   Sender ID:', testMessage.sender_id);
    console.log('   Content preview:', testMessage.content?.substring(0, 50) + '...');
    
    // Now try to delete the message
    console.log('\n5. Attempting to delete the test message...');
    const deleteRes = await fetch('http://localhost:3000/api/messages', {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({ message_id: testMessage._id })
    });
    
    console.log('   Delete request status:', deleteRes.status);
    
    if (!deleteRes.ok) {
      console.error('❌ Delete request failed with status:', deleteRes.status);
      const errorText = await deleteRes.text();
      console.error('   Error response:', errorText);
      return;
    }
    
    const deleteData = await deleteRes.json();
    console.log('   Delete response:', JSON.stringify(deleteData, null, 2));
    
    if (deleteData.success) {
      console.log('✅ Delete API call reported success!');
      
      // Verify the message was actually deleted
      console.log('\n6. Verifying message was deleted...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait a moment
      
      const verifyRes = await fetch(`http://localhost:3000/api/messages?user_id=${otherUser.user_id}`, {
        headers: { 'Cookie': sessionCookie }
      });
      
      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        if (verifyData.success && verifyData.messages) {
          const stillExists = verifyData.messages.find(msg => msg._id === testMessage._id);
          if (stillExists) {
            console.error('❌ Message still exists after delete!');
            console.log('   Message still found:', {
              id: stillExists._id,
              content: stillExists.content?.substring(0, 50) + '...'
            });
          } else {
            console.log('✅ SUCCESS! Message was successfully deleted!');
            console.log('   Messages count after delete:', verifyData.messages.length);
          }
        }
      } else {
        console.error('❌ Failed to verify deletion');
      }
      
    } else {
      console.error('❌ Delete API call failed!');
      console.error('   Error details:', deleteData);
      
      // Let's check what the actual error was
      if (deleteData.message) {
        console.error('   Error message:', deleteData.message);
      }
    }
    
  } catch (error) {
    console.error('💥 Test error:', error);
  }
}

console.log('🚀 Starting delete message test...');
testDeleteMessageAPI().catch(console.error);