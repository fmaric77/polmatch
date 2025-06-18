// Test script to debug reply persistence issue across channel switches
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

// Helper function to make requests with cookies
async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'User-Agent': 'Mozilla/5.0 (compatible; test-script)',
    },
  });
  return response;
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  setCookies(response) {
    const setCookieHeaders = response.headers.raw()['set-cookie'] || [];
    setCookieHeaders.forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      this.cookies.set(name.trim(), value?.trim() || '');
    });
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

async function testReplyPersistence() {
  console.log('🔍 Testing reply message persistence across channel switches...\n');

  const cookieJar = new CookieJar();

  try {
    // Step 1: Login
    console.log('📋 Step 1: Logging in...');
    const loginResponse = await makeRequest(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    cookieJar.setCookies(loginResponse);
    console.log('✅ Login successful\n');

    // Step 2: Get groups
    console.log('📋 Step 2: Fetching groups...');
    const groupsResponse = await makeRequest(`${BASE_URL}/api/groups/list`, {
      headers: { 'Cookie': cookieJar.getCookieHeader() }
    });

    const groupsData = await groupsResponse.json();
    if (!groupsData.success || !groupsData.groups || groupsData.groups.length === 0) {
      throw new Error('No groups found');
    }

    const testGroup = groupsData.groups[0];
    console.log(`✅ Using group: ${testGroup.name} (${testGroup.group_id})\n`);

    // Step 3: Get channels
    console.log('📋 Step 3: Fetching channels...');
    const channelsResponse = await makeRequest(`${BASE_URL}/api/groups/${testGroup.group_id}/channels`, {
      headers: { 'Cookie': cookieJar.getCookieHeader() }
    });

    const channelsData = await channelsResponse.json();
    if (!channelsData.success || !channelsData.channels || channelsData.channels.length === 0) {
      throw new Error('No channels found');
    }

    const testChannels = channelsData.channels.slice(0, 2); // Use first 2 channels
    console.log(`✅ Using channels: ${testChannels.map(ch => ch.name).join(', ')}\n`);

    // Step 4: Send a message in the first channel
    console.log('📋 Step 4: Sending original message...');
    const originalMessageResponse = await makeRequest(`${BASE_URL}/api/groups/${testGroup.group_id}/channels/${testChannels[0].channel_id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieJar.getCookieHeader()
      },
      body: JSON.stringify({
        content: 'This is the original message to reply to',
        attachments: []
      })
    });

    const originalMessageData = await originalMessageResponse.json();
    if (!originalMessageData.success) {
      throw new Error(`Failed to send original message: ${originalMessageData.error}`);
    }

    const originalMessage = originalMessageData.message;
    console.log(`✅ Original message sent: ${originalMessage.message_id}\n`);

    // Wait a moment to ensure message is stored
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 5: Send a reply to the original message
    console.log('📋 Step 5: Sending reply message...');
    const replyMessageResponse = await makeRequest(`${BASE_URL}/api/groups/${testGroup.group_id}/channels/${testChannels[0].channel_id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieJar.getCookieHeader()
      },
      body: JSON.stringify({
        content: 'This is a reply to the original message',
        attachments: [],
        reply_to: {
          message_id: originalMessage.message_id,
          content: originalMessage.content.substring(0, 100), // Limit length
          sender_name: 'SOKOL'
        }
      })
    });

    const replyMessageData = await replyMessageResponse.json();
    if (!replyMessageData.success) {
      throw new Error(`Failed to send reply message: ${replyMessageData.error}`);
    }

    const replyMessage = replyMessageData.message;
    console.log(`✅ Reply message sent: ${replyMessage.message_id}\n`);

    // Wait a moment to ensure message is stored
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 6: Fetch messages from the first channel and verify reply is present
    console.log('📋 Step 6: Fetching messages from first channel...');
    const firstChannelMessagesResponse = await makeRequest(`${BASE_URL}/api/groups/${testGroup.group_id}/channels/${testChannels[0].channel_id}/messages`, {
      headers: { 'Cookie': cookieJar.getCookieHeader() }
    });

    const firstChannelMessagesData = await firstChannelMessagesResponse.json();
    if (!firstChannelMessagesData.success) {
      throw new Error(`Failed to fetch messages from first channel: ${firstChannelMessagesData.error}`);
    }

    const firstChannelMessages = firstChannelMessagesData.messages;
    console.log(`✅ Found ${firstChannelMessages.length} messages in first channel`);

    // Find the reply message
    const replyInFirstChannel = firstChannelMessages.find(msg => msg.message_id === replyMessage.message_id);
    if (!replyInFirstChannel) {
      throw new Error('Reply message not found in first channel');
    }

    console.log('📧 Reply message in first channel:');
    console.log(`   Content: ${replyInFirstChannel.content}`);
    console.log(`   Has reply_to: ${!!replyInFirstChannel.reply_to}`);
    if (replyInFirstChannel.reply_to) {
      console.log(`   Reply to message_id: ${replyInFirstChannel.reply_to.message_id}`);
      console.log(`   Reply to content: ${replyInFirstChannel.reply_to.content}`);
      console.log(`   Reply to sender: ${replyInFirstChannel.reply_to.sender_name}`);
    }
    console.log();

    // Step 7: Fetch messages from the second channel (simulate channel switch)
    console.log('📋 Step 7: Simulating channel switch - fetching messages from second channel...');
    const secondChannelMessagesResponse = await makeRequest(`${BASE_URL}/api/groups/${testGroup.group_id}/channels/${testChannels[1].channel_id}/messages`, {
      headers: { 'Cookie': cookieJar.getCookieHeader() }
    });

    const secondChannelMessagesData = await secondChannelMessagesResponse.json();
    if (!secondChannelMessagesData.success) {
      throw new Error(`Failed to fetch messages from second channel: ${secondChannelMessagesData.error}`);
    }

    const secondChannelMessages = secondChannelMessagesData.messages;
    console.log(`✅ Found ${secondChannelMessages.length} messages in second channel\n`);

    // Step 8: Go back to the first channel and verify reply is still there
    console.log('📋 Step 8: Switching back to first channel - fetching messages again...');
    const backToFirstChannelResponse = await makeRequest(`${BASE_URL}/api/groups/${testGroup.group_id}/channels/${testChannels[0].channel_id}/messages`, {
      headers: { 'Cookie': cookieJar.getCookieHeader() }
    });

    const backToFirstChannelData = await backToFirstChannelResponse.json();
    if (!backToFirstChannelData.success) {
      throw new Error(`Failed to fetch messages when switching back to first channel: ${backToFirstChannelData.error}`);
    }

    const backToFirstChannelMessages = backToFirstChannelData.messages;
    console.log(`✅ Found ${backToFirstChannelMessages.length} messages when switching back to first channel`);

    // Find the reply message again
    const replyAfterSwitch = backToFirstChannelMessages.find(msg => msg.message_id === replyMessage.message_id);
    if (!replyAfterSwitch) {
      throw new Error('Reply message not found after channel switch');
    }

    console.log('📧 Reply message after channel switch:');
    console.log(`   Content: ${replyAfterSwitch.content}`);
    console.log(`   Has reply_to: ${!!replyAfterSwitch.reply_to}`);
    if (replyAfterSwitch.reply_to) {
      console.log(`   Reply to message_id: ${replyAfterSwitch.reply_to.message_id}`);
      console.log(`   Reply to content: ${replyAfterSwitch.reply_to.content}`);
      console.log(`   Reply to sender: ${replyAfterSwitch.reply_to.sender_name}`);
    }
    console.log();

    // Step 9: Compare reply data before and after switch
    console.log('📋 Step 9: Comparing reply data...');
    const replyDataBefore = replyInFirstChannel.reply_to;
    const replyDataAfter = replyAfterSwitch.reply_to;

    if (!replyDataBefore && !replyDataAfter) {
      console.log('❌ ISSUE: Reply data is missing both before and after channel switch');
    } else if (!replyDataBefore) {
      console.log('❌ ISSUE: Reply data was missing initially');
    } else if (!replyDataAfter) {
      console.log('❌ ISSUE: Reply data was lost after channel switch');
    } else {
      // Both have reply data, compare them
      const beforeStr = JSON.stringify(replyDataBefore);
      const afterStr = JSON.stringify(replyDataAfter);

      if (beforeStr === afterStr) {
        console.log('✅ SUCCESS: Reply data is identical before and after channel switch');
      } else {
        console.log('❌ ISSUE: Reply data changed after channel switch');
        console.log('Before:', beforeStr);
        console.log('After:', afterStr);
      }
    }

    console.log('\n🎉 Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testReplyPersistence();
