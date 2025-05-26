const fetch = require('node-fetch');

async function testMessagesAPIFix() {
  try {
    console.log('🔧 Testing Messages API Fix');
    
    // First login
    console.log('\n1. Logging in...');
    const loginResponse = await fetch('http://localhost:3001/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    const loginData = await loginResponse.json();
    if (!loginData.success) {
      console.error('❌ Login failed');
      return;
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    const sessionMatch = cookies.match(/session=([^;]+)/);
    const sessionToken = sessionMatch ? sessionMatch[1] : null;
    
    if (!sessionToken) {
      console.error('❌ No session token found');
      return;
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'Cookie': `session=${sessionToken}`
    };
    
    // Get private conversations to find a user_id to test with
    console.log('\n2. Getting private conversations...');
    const conversationsResponse = await fetch('http://localhost:3001/api/private-conversations', { headers });
    const conversationsData = await conversationsResponse.json();
    
    console.log('Conversations response:', JSON.stringify(conversationsData, null, 2));
    
    if (!conversationsData.success || !conversationsData.conversations || conversationsData.conversations.length === 0) {
      console.error('❌ No conversations found to test with');
      return;
    }
    
    const testUserId = conversationsData.conversations[0].other_user.user_id;
    console.log('✅ Found test user_id:', testUserId);
    
    // Test the old way (without user_id parameter) - should return conversations
    console.log('\n3. Testing /api/messages without user_id (should return conversations)...');
    const messagesWithoutParamResponse = await fetch('http://localhost:3001/api/messages', { headers });
    const messagesWithoutParamData = await messagesWithoutParamResponse.json();
    
    console.log('Messages without param response status:', messagesWithoutParamResponse.status);
    console.log('Messages without param data structure:', {
      success: messagesWithoutParamData.success,
      hasConversations: !!messagesWithoutParamData.conversations,
      hasMessages: !!messagesWithoutParamData.messages,
      hasPms: !!messagesWithoutParamData.pms
    });
    
    // Test the new way (with user_id parameter) - should return messages
    console.log('\n4. Testing /api/messages with user_id (should return messages)...');
    const messagesWithParamResponse = await fetch(`http://localhost:3001/api/messages?user_id=${testUserId}`, { headers });
    const messagesWithParamData = await messagesWithParamResponse.json();
    
    console.log('Messages with param response status:', messagesWithParamResponse.status);
    console.log('Messages with param data structure:', {
      success: messagesWithParamData.success,
      hasConversations: !!messagesWithParamData.conversations,
      hasMessages: !!messagesWithParamData.messages,
      hasPms: !!messagesWithParamData.pms,
      messageCount: messagesWithParamData.messages ? messagesWithParamData.messages.length : 0
    });
    
    if (messagesWithParamData.success && messagesWithParamData.messages) {
      console.log('✅ Messages API with user_id parameter working correctly!');
      console.log(`Found ${messagesWithParamData.messages.length} messages for user ${testUserId}`);
      
      if (messagesWithParamData.messages.length > 0) {
        console.log('Sample message:', {
          sender_id: messagesWithParamData.messages[0].sender_id,
          receiver_id: messagesWithParamData.messages[0].receiver_id,
          content: messagesWithParamData.messages[0].content,
          timestamp: messagesWithParamData.messages[0].timestamp
        });
      }
    } else {
      console.error('❌ Messages API with user_id parameter not working properly');
    }
    
    console.log('\n✅ API Fix Test Completed');
    
  } catch (error) {
    console.error('❌ API Fix Test failed:', error);
  }
}

testMessagesAPIFix();
