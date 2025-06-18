#!/usr/bin/env node
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testDirectMessageReply() {
  console.log('=== Testing Direct Message Reply Functionality ===\n');

  try {
    // 1. Login as sokol
    console.log('1. Logging in as sokol@example.com...');
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });

    const loginData = await loginResponse.json();
    if (!loginData.success) {
      console.error('❌ Login failed:', loginData);
      return;
    }

    console.log('✅ Login successful');
    const sessionCookie = loginResponse.headers.get('set-cookie');

    // 2. Get users
    console.log('\n2. Getting users...');
    const usersResponse = await fetch(`${BASE_URL}/api/users/list`, {
      headers: { 'Cookie': sessionCookie }
    });

    const usersData = await usersResponse.json();
    if (!usersData.success || usersData.users.length < 2) {
      console.error('❌ Need at least 2 users for testing');
      return;
    }

    const otherUser = usersData.users.find(u => u.user_id !== loginData.user.user_id);
    console.log(`✅ Testing with user: ${otherUser.username} (${otherUser.user_id})`);

    // 3. Send initial message
    console.log('\n3. Sending initial direct message...');
    const initialContent = `Hey, anyone up for a game later tonight? [${Date.now()}]`;
    
    const initialResponse = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        receiver_id: otherUser.user_id,
        content: initialContent,
        attachments: []
      })
    });

    const initialData = await initialResponse.json();
    console.log('Initial message response:', initialData);
    
    if (!initialData.success) {
      console.error('❌ Failed to send initial message:', initialData);
      return;
    }

    console.log('✅ Initial message sent');
    const originalMessageId = initialData.message._id || initialData.message.message_id;
    console.log('Original message ID:', originalMessageId);

    // 4. Send reply message
    console.log('\n4. Sending reply message...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const replyContent = `Sure! What time are you thinking? [${Date.now()}]`;
    const replyPayload = {
      receiver_id: otherUser.user_id,
      content: replyContent,
      attachments: [],
      reply_to: {
        message_id: originalMessageId,
        content: initialContent,
        sender_name: loginData.user.username || 'SOKOL'
      }
    };

    console.log('Reply payload:', JSON.stringify(replyPayload, null, 2));

    const replyResponse = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify(replyPayload)
    });

    const replyData = await replyResponse.json();
    console.log('Reply response status:', replyResponse.status);
    console.log('Reply response:', replyData);

    if (replyData.success) {
      console.log('✅ SUCCESS: Direct message reply sent successfully!');
      console.log('Reply message structure:');
      console.log('  Content:', replyData.message.content);
      if (replyData.message.reply_to) {
        console.log('  Reply to:', replyData.message.reply_to);
      } else {
        console.log('  ❌ No reply_to field in response');
      }
    } else {
      console.log('❌ Direct message reply failed:', replyData);
      return;
    }

    // 5. Fetch messages to verify reply structure
    console.log('\n5. Fetching messages to verify reply structure...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const messagesResponse = await fetch(`${BASE_URL}/api/messages?user_id=${otherUser.user_id}`, {
      headers: { 'Cookie': sessionCookie }
    });

    const messagesData = await messagesResponse.json();
    if (messagesData.success) {
      console.log(`✅ Fetched ${messagesData.messages.length} messages`);
      
      console.log('\n📋 Message analysis:');
      messagesData.messages.forEach((msg, index) => {
        const contentPreview = msg.content ? msg.content.substring(0, 50) : '[No content]';
        console.log(`  ${index + 1}. ${contentPreview}...`);
        console.log(`     ID: ${msg._id || msg.message_id}`);
        console.log(`     Sender: ${msg.sender_id}`);
        console.log(`     Has reply_to: ${!!msg.reply_to}`);
        if (msg.reply_to) {
          console.log(`     Reply to: ${msg.reply_to.sender_name} - "${msg.reply_to.content.substring(0, 30)}..."`);
          console.log(`     Reply message_id: ${msg.reply_to.message_id}`);
        }
        console.log('');
      });
      
      const replyMessage = messagesData.messages.find(msg => 
        msg.content && msg.content.includes('Sure! What time') && msg.reply_to
      );

      if (replyMessage) {
        console.log('🎉 SUCCESS: Found direct message reply with proper structure!');
      } else {
        console.log('❌ No direct message reply found with proper structure');
        
        // Check if the reply message exists but without reply_to
        const replyWithoutStructure = messagesData.messages.find(msg => 
          msg.content && msg.content.includes('Sure! What time')
        );
        
        if (replyWithoutStructure) {
          console.log('⚠️  Found reply message but without reply_to structure');
          console.log('   This means the backend is not saving reply_to for direct messages');
        }
      }
    } else {
      console.log('❌ Failed to fetch messages:', messagesData);
    }

    console.log('\n🎯 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDirectMessageReply();
