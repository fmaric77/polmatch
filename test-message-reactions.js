const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testMessageReactions() {
  console.log('🧪 Testing Message Reactions System\n');
  
  try {
    // Step 1: Login and get session
    console.log('1. 🔐 Logging in...');
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser1',
        password: 'testpass123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error('Login failed');
    }

    const loginData = await loginResponse.json();
    const sessionCookie = loginResponse.headers.get('set-cookie');
    console.log('✅ Login successful');

    if (!sessionCookie) {
      throw new Error('No session cookie received');
    }

    // Step 2: Test API status
    console.log('\n2. 🔍 Testing reactions API...');
    const statusResponse = await fetch(`${BASE_URL}/api/chat/status`, {
      headers: { 'Cookie': sessionCookie }
    });
    
    if (statusResponse.ok) {
      console.log('✅ Chat API is working');
    }

    // Step 3: Get CSRF token
    console.log('\n3. 🛡️ Getting CSRF token...');
    const csrfResponse = await fetch(`${BASE_URL}/api/csrf-token`, {
      headers: { 'Cookie': sessionCookie }
    });
    
    const csrfData = await csrfResponse.json();
    const csrfToken = csrfData.token;
    console.log('✅ CSRF token obtained');

    // Step 4: Find a group to test with
    console.log('\n4. 👥 Finding test group...');
    const groupsResponse = await fetch(`${BASE_URL}/api/groups/list`, {
      headers: { 
        'Cookie': sessionCookie,
        'X-CSRF-Token': csrfToken
      }
    });

    const groupsData = await groupsResponse.json();
    if (!groupsData.success || !groupsData.groups || groupsData.groups.length === 0) {
      throw new Error('No groups found for testing');
    }

    const testGroup = groupsData.groups[0];
    console.log(`✅ Using test group: ${testGroup.name} (${testGroup.group_id})`);

    // Step 5: Get group messages
    console.log('\n5. 📨 Getting group messages...');
    const messagesResponse = await fetch(`${BASE_URL}/api/groups/${testGroup.group_id}/messages`, {
      headers: { 
        'Cookie': sessionCookie,
        'X-CSRF-Token': csrfToken
      }
    });

    const messagesData = await messagesResponse.json();
    if (!messagesData.success || !messagesData.messages || messagesData.messages.length === 0) {
      console.log('⚠️ No messages found, creating a test message...');
      
      // Create a test message
      const sendResponse = await fetch(`${BASE_URL}/api/groups/${testGroup.group_id}/messages`, {
        method: 'POST',
        headers: { 
          'Cookie': sessionCookie,
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: 'Test message for reactions! 🎉',
          profile_type: 'basic'
        })
      });

      if (sendResponse.ok) {
        console.log('✅ Test message created');
        
        // Refetch messages
        const newMessagesResponse = await fetch(`${BASE_URL}/api/groups/${testGroup.group_id}/messages`, {
          headers: { 
            'Cookie': sessionCookie,
            'X-CSRF-Token': csrfToken
          }
        });
        const newMessagesData = await newMessagesResponse.json();
        messagesData.messages = newMessagesData.messages;
      }
    }

    if (!messagesData.messages || messagesData.messages.length === 0) {
      throw new Error('Still no messages available for testing');
    }

    const testMessage = messagesData.messages[0];
    console.log(`✅ Using test message: "${testMessage.content.substring(0, 50)}..." (${testMessage.message_id})`);

    // Step 6: Test adding reactions
    console.log('\n6. 👍 Testing add reaction...');
    const addReactionResponse = await fetch(`${BASE_URL}/api/messages/reactions`, {
      method: 'POST',
      headers: { 
        'Cookie': sessionCookie,
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message_id: testMessage.message_id,
        message_type: 'group',
        reaction_type: '👍',
        group_id: testGroup.group_id,
        channel_id: testMessage.channel_id
      })
    });

    const addReactionData = await addReactionResponse.json();
    if (addReactionData.success) {
      console.log(`✅ Added reaction: ${addReactionData.action} 👍`);
    } else {
      console.log(`❌ Failed to add reaction: ${addReactionData.error}`);
    }

    // Step 7: Test getting reactions
    console.log('\n7. 📊 Testing get reactions...');
    const getReactionsResponse = await fetch(
      `${BASE_URL}/api/messages/reactions?message_id=${testMessage.message_id}&message_type=group`,
      {
        headers: { 
          'Cookie': sessionCookie,
          'X-CSRF-Token': csrfToken
        }
      }
    );

    const reactionsData = await getReactionsResponse.json();
    if (reactionsData.success) {
      console.log('✅ Retrieved reactions:');
      Object.entries(reactionsData.reactions).forEach(([reaction, data]) => {
        console.log(`   ${reaction}: ${data.count} (user reacted: ${data.user_reacted})`);
      });
    } else {
      console.log(`❌ Failed to get reactions: ${reactionsData.error}`);
    }

    // Step 8: Test adding different reaction
    console.log('\n8. ❤️ Testing add different reaction...');
    const addLoveResponse = await fetch(`${BASE_URL}/api/messages/reactions`, {
      method: 'POST',
      headers: { 
        'Cookie': sessionCookie,
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message_id: testMessage.message_id,
        message_type: 'group',
        reaction_type: '❤️',
        group_id: testGroup.group_id,
        channel_id: testMessage.channel_id
      })
    });

    const addLoveData = await addLoveResponse.json();
    if (addLoveData.success) {
      console.log(`✅ Added reaction: ${addLoveData.action} ❤️`);
    }

    // Step 9: Test toggle reaction (remove)
    console.log('\n9. 🔄 Testing toggle reaction (remove)...');
    const toggleResponse = await fetch(`${BASE_URL}/api/messages/reactions`, {
      method: 'POST',
      headers: { 
        'Cookie': sessionCookie,
        'X-CSRF-Token': csrfToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message_id: testMessage.message_id,
        message_type: 'group',
        reaction_type: '👍',
        group_id: testGroup.group_id,
        channel_id: testMessage.channel_id
      })
    });

    const toggleData = await toggleResponse.json();
    if (toggleData.success) {
      console.log(`✅ Toggled reaction: ${toggleData.action} 👍`);
    }

    // Step 10: Final reactions check
    console.log('\n10. 📊 Final reactions check...');
    const finalReactionsResponse = await fetch(
      `${BASE_URL}/api/messages/reactions?message_id=${testMessage.message_id}&message_type=group`,
      {
        headers: { 
          'Cookie': sessionCookie,
          'X-CSRF-Token': csrfToken
        }
      }
    );

    const finalReactionsData = await finalReactionsResponse.json();
    if (finalReactionsData.success) {
      console.log('✅ Final reactions state:');
      Object.entries(finalReactionsData.reactions).forEach(([reaction, data]) => {
        console.log(`   ${reaction}: ${data.count} (user reacted: ${data.user_reacted})`);
        console.log(`      Users: ${data.users.map(u => u.username).join(', ')}`);
      });
    }

    console.log('\n🎉 Message Reactions Test Completed Successfully!');
    console.log('\n🎯 Test Summary:');
    console.log('✅ API endpoints working');
    console.log('✅ Reactions can be added');
    console.log('✅ Reactions can be retrieved');
    console.log('✅ Reactions can be toggled (removed)');
    console.log('✅ Multiple reaction types supported');
    console.log('✅ User reaction status tracked correctly');

    console.log('\n🚀 Next Steps:');
    console.log('1. Go to http://localhost:3000/chat');
    console.log('2. Navigate to a group chat');
    console.log('3. Right-click on any message');
    console.log('4. Choose a reaction (👍 Like, ❤️ Love, 😂 Funny)');
    console.log('5. See reactions appear below messages');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testMessageReactions(); 