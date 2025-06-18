#!/usr/bin/env node
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testGroupReply() {
  console.log('=== Testing Group Reply Functionality ===\n');

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

    // 2. Get groups
    console.log('\n2. Getting groups...');
    const groupsResponse = await fetch(`${BASE_URL}/api/groups/list`, {
      headers: { 'Cookie': sessionCookie }
    });

    const groupsData = await groupsResponse.json();
    if (!groupsData.success || groupsData.groups.length === 0) {
      console.error('❌ No groups available for testing');
      return;
    }

    const testGroup = groupsData.groups[0];
    console.log(`✅ Testing with group: ${testGroup.name} (${testGroup.group_id})`);

    // 3. Send initial message
    console.log('\n3. Sending initial message...');
    const initialContent = `Hey, anyone up for a game later tonight? [${Date.now()}]`;
    
    let messageUrl = `/api/groups/${testGroup.group_id}/channels/${testGroup.default_channel_id}/messages`;
    
    const initialResponse = await fetch(`${BASE_URL}${messageUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
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
    const originalMessageId = initialData.message.message_id;

    // 4. Send reply message
    console.log('\n4. Sending reply message...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const replyContent = `Sure! What time are you thinking? [${Date.now()}]`;
    const replyPayload = {
      content: replyContent,
      attachments: [],
      reply_to: {
        message_id: originalMessageId,
        content: initialContent,
        sender_name: loginData.user.username || 'SOKOL'
      }
    };

    console.log('Reply payload:', JSON.stringify(replyPayload, null, 2));

    const replyResponse = await fetch(`${BASE_URL}${messageUrl}`, {
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
      console.log('🎉 SUCCESS: Group reply sent successfully!');
      console.log('Reply message structure:');
      console.log('  Content:', replyData.message.content);
      if (replyData.message.reply_to) {
        console.log('  Reply to:', replyData.message.reply_to);
      }
    } else {
      console.log('❌ Group reply failed:', replyData);
    }

    // 5. Fetch messages to verify reply structure
    console.log('\n5. Fetching messages to verify reply structure...');
    const fetchUrl = `/api/groups/${testGroup.group_id}/channels/${testGroup.default_channel_id}/messages`;
    
    const messagesResponse = await fetch(`${BASE_URL}${fetchUrl}`, {
      headers: { 'Cookie': sessionCookie }
    });

    const messagesData = await messagesResponse.json();
    if (messagesData.success) {
      console.log(`✅ Fetched ${messagesData.messages.length} messages`);
      
      const replyMessage = messagesData.messages.find(msg => 
        msg.content && msg.content.includes('Sure! What time') && msg.reply_to
      );

      if (replyMessage) {
        console.log('🎉 SUCCESS: Found reply message with proper structure!');
        console.log('Reply message details:');
        console.log('  Content:', replyMessage.content);
        console.log('  Reply to:', replyMessage.reply_to);
      } else {
        console.log('❌ No reply message found with proper structure');
        console.log('Messages:');
        messagesData.messages.forEach((msg, index) => {
          console.log(`  ${index + 1}. ${msg.content ? msg.content.substring(0, 50) : '[No content]'}...`);
          if (msg.reply_to) {
            console.log(`     Reply to: ${msg.reply_to.sender_name} - "${msg.reply_to.content.substring(0, 30)}..."`);
          }
        });
      }
    } else {
      console.log('❌ Failed to fetch messages:', messagesData);
    }

    console.log('\n🎯 Test completed! Now try the UI:');
    console.log('1. Go to http://localhost:3000/chat');
    console.log('2. Select the group you just tested');
    console.log('3. Right-click on any message');
    console.log('4. Select "Reply" from the context menu');
    console.log('5. You should see the Discord-style quote box above your reply');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testGroupReply();
