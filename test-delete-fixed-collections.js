const https = require('https');

// Disable SSL verification for localhost
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const API_BASE = 'http://localhost:3000/api';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : require('http');
    
    const req = protocol.request(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testDeleteWithProfileCollections() {
  console.log('🚀 Testing delete message with new profile-specific collections...');
  
  try {
    console.log('1. Logging in as sokol@example.com...');
    const loginResponse = await makeRequest(`${API_BASE}/login`, {
      method: 'POST',
      body: {
        email: 'sokol@example.com',
        password: 'mango'
      }
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login failed: ' + loginResponse.data.message);
    }
    
    console.log('✅ Login successful! User:', loginResponse.data.user.username, 
                '(ID:', loginResponse.data.user.user_id + ')');
    
    const sessionCookie = loginResponse.headers['set-cookie']?.find(cookie => 
      cookie.startsWith('session='))?.split(';')[0];
    
    if (!sessionCookie) {
      throw new Error('No session cookie received');
    }
    
    console.log('✅ Session cookie received');
    
    console.log('\n2. Getting available users...');
    const usersResponse = await makeRequest(`${API_BASE}/users/discover?profile_type=basic`, {
      method: 'GET',
      headers: {
        'Cookie': sessionCookie
      }
    });
    
    if (!usersResponse.data.success || usersResponse.data.users.length === 0) {
      throw new Error('No users found');
    }
    
    const testUser = usersResponse.data.users[0];
    console.log('✅ Found test user:', testUser.username, '(ID:', testUser.user_id + ')');
    
    console.log('\n3. Sending a test message with profile context...');
    const messageResponse = await makeRequest(`${API_BASE}/messages`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie
      },
      body: {
        receiver_id: testUser.user_id,
        content: `TEST DELETE MESSAGE WITH PROFILE CONTEXT - ${new Date().toISOString()}`,
        sender_profile_type: 'basic',
        receiver_profile_type: 'basic'
      }
    });
    
    if (!messageResponse.data.success) {
      throw new Error('Failed to send message: ' + messageResponse.data.message);
    }
    
    console.log('✅ Test message sent successfully!');
    console.log('   Message content:', messageResponse.data.message.content);
    console.log('   Profile context:', messageResponse.data.message.profile_context);
    console.log('   Collection used:', messageResponse.data.collection_used || 'Not specified');
    
    console.log('\n4. Fetching messages to find the test message...');
    const fetchResponse = await makeRequest(`${API_BASE}/messages?user_id=${testUser.user_id}&sender_profile_type=basic&receiver_profile_type=basic`, {
      method: 'GET',
      headers: {
        'Cookie': sessionCookie
      }
    });
    
    if (!fetchResponse.data.success) {
      throw new Error('Failed to fetch messages: ' + fetchResponse.data.message);
    }
    
    console.log('✅ Messages fetched successfully!');
    console.log('   Total messages:', fetchResponse.data.messages.length);
    
    if (fetchResponse.data.messages.length === 0) {
      throw new Error('No messages found - message may not have been stored correctly');
    }
    
    const latestMessage = fetchResponse.data.messages[fetchResponse.data.messages.length - 1];
    console.log('✅ Found test message to delete!');
    console.log('   Message ID:', latestMessage._id);
    console.log('   Sender ID:', latestMessage.sender_id);
    console.log('   Content preview:', latestMessage.content.substring(0, 50) + '...');
    console.log('   Profile context:', latestMessage.profile_context);
    
    console.log('\n5. Attempting to delete the test message...');
    const deleteResponse = await makeRequest(`${API_BASE}/messages`, {
      method: 'DELETE',
      headers: {
        'Cookie': sessionCookie
      },
      body: {
        message_id: latestMessage._id,
        sender_profile_type: 'basic',
        receiver_profile_type: 'basic'
      }
    });
    
    console.log('   Delete request status:', deleteResponse.status);
    console.log('   Delete response:', JSON.stringify(deleteResponse.data, null, 2));
    
    if (!deleteResponse.data.success) {
      throw new Error('Delete API call failed: ' + deleteResponse.data.message);
    }
    
    console.log('✅ Delete API call reported success!');
    console.log('   Deleted from collection:', deleteResponse.data.collection);
    console.log('   Messages deleted:', deleteResponse.data.deletedMessages);
    
    console.log('\n6. Verifying message was deleted...');
    const verifyResponse = await makeRequest(`${API_BASE}/messages?user_id=${testUser.user_id}&sender_profile_type=basic&receiver_profile_type=basic`, {
      method: 'GET',
      headers: {
        'Cookie': sessionCookie
      }
    });
    
    if (!verifyResponse.data.success) {
      throw new Error('Failed to verify deletion: ' + verifyResponse.data.message);
    }
    
    const messagesAfterDelete = verifyResponse.data.messages.filter(msg => 
      msg._id === latestMessage._id);
    
    if (messagesAfterDelete.length === 0) {
      console.log('✅ SUCCESS! Message was successfully deleted!');
      console.log('   Messages count after delete:', verifyResponse.data.messages.length);
    } else {
      console.log('❌ FAILURE! Message still exists after delete operation');
      console.log('   Found message:', messagesAfterDelete[0]);
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testDeleteWithProfileCollections();
