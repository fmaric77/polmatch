const { MongoClient } = require('mongodb');

async function testDeleteMessage() {
  try {
    console.log('Starting delete message test...');
    
    // First, let's check what users exist
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('\n1. Checking available users...');
    const users = await db.collection('users').find({}, { projection: { user_id: 1, username: 1, email: 1 } }).toArray();
    console.log('Available users:', users.map(u => ({ user_id: u.user_id, username: u.username, email: u.email })));
    
    // Find sokol user
    const sokolUser = users.find(u => u.email === 'sokol@example.com');
    if (!sokolUser) {
      console.error('Sokol user not found!');
      await client.close();
      return;
    }
    
    console.log('Sokol user found:', sokolUser);
    
    // Find another user to message with
    const otherUser = users.find(u => u.user_id !== sokolUser.user_id);
    if (!otherUser) {
      console.error('No other user found to test with!');
      await client.close();
      return;
    }
    
    console.log('Testing with other user:', otherUser);
    
    // Check existing private messages between these users
    console.log('\n2. Checking existing private messages...');
    const sortedParticipants = [sokolUser.user_id, otherUser.user_id].sort();
    const existingMessages = await db.collection('pm').find({
      participant_ids: sortedParticipants
    }).toArray();
    
    console.log(`Found ${existingMessages.length} existing messages between users`);
    existingMessages.forEach((msg, index) => {
      console.log(`Message ${index + 1}:`, {
        _id: msg._id,
        sender_id: msg.sender_id,
        content: msg.encrypted_content ? '[ENCRYPTED]' : msg.content,
        timestamp: msg.timestamp
      });
    });
    
    await client.close();
    
    // Now test the API endpoints
    console.log('\n3. Testing API endpoints...');
    
    // Login
    console.log('Logging in as sokol...');
    const loginRes = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    const loginData = await loginRes.json();
    if (!loginData.success) {
      console.error('Login failed:', loginData);
      return;
    }
    
    console.log('Login successful, user:', loginData.user.username);
    
    // Get session cookie
    const sessionCookie = loginRes.headers.get('set-cookie');
    console.log('Session cookie:', sessionCookie);
    
    // Send a test message first if no messages exist
    if (existingMessages.length === 0) {
      console.log('\n4. Sending a test message...');
      const sendRes = await fetch('http://localhost:3000/api/messages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        },
        body: JSON.stringify({ 
          receiver_id: otherUser.user_id,
          content: 'Test message for deletion - ' + new Date().toISOString(),
          attachments: []
        })
      });
      
      const sendData = await sendRes.json();
      console.log('Send message response:', sendData.success ? 'SUCCESS' : 'FAILED', sendData);
      
      if (!sendData.success) {
        console.error('Failed to send test message, cannot test delete');
        return;
      }
    }
    
    // Get messages via API
    console.log('\n5. Fetching messages via API...');
    const messagesRes = await fetch(`http://localhost:3000/api/messages?user_id=${otherUser.user_id}`, {
      headers: {
        'Cookie': sessionCookie
      }
    });
    
    const messagesData = await messagesRes.json();
    console.log('Messages API response status:', messagesRes.status);
    console.log('Messages API response:', messagesData.success ? 'SUCCESS' : 'FAILED');
    
    if (messagesData.success && messagesData.messages && messagesData.messages.length > 0) {
      console.log(`Found ${messagesData.messages.length} messages via API`);
      
      // Find a message sent by sokol to delete
      const messageToDelete = messagesData.messages.find(msg => msg.sender_id === sokolUser.user_id);
      
      if (!messageToDelete) {
        console.log('No messages sent by sokol found, cannot test delete');
        return;
      }
      
      console.log('\n6. Found message to delete:');
      console.log('Message ID:', messageToDelete._id);
      console.log('Sender ID:', messageToDelete.sender_id);
      console.log('Content:', messageToDelete.content);
      console.log('Timestamp:', messageToDelete.timestamp);
      
      // Try to delete the message
      console.log('\n7. Attempting to delete message...');
      const deleteRes = await fetch('http://localhost:3000/api/messages', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': sessionCookie
        },
        body: JSON.stringify({ message_id: messageToDelete._id })
      });
      
      const deleteData = await deleteRes.json();
      console.log('Delete response status:', deleteRes.status);
      console.log('Delete response:', JSON.stringify(deleteData, null, 2));
      
      if (deleteData.success) {
        console.log('✅ Delete API call successful!');
        
        // Verify the message was actually deleted
        console.log('\n8. Verifying message was deleted...');
        const verifyRes = await fetch(`http://localhost:3000/api/messages?user_id=${otherUser.user_id}`, {
          headers: {
            'Cookie': sessionCookie
          }
        });
        
        const verifyData = await verifyRes.json();
        if (verifyData.success && verifyData.messages) {
          const stillExists = verifyData.messages.find(msg => msg._id === messageToDelete._id);
          if (stillExists) {
            console.log('❌ Message still exists after delete!');
          } else {
            console.log('✅ Message successfully deleted!');
          }
          console.log(`Messages count after delete: ${verifyData.messages.length}`);
        }
      } else {
        console.log('❌ Delete API call failed!');
        console.log('Error details:', deleteData);
      }
      
    } else {
      console.log('No messages found via API');
      console.log('API response:', messagesData);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testDeleteMessage().catch(console.error);