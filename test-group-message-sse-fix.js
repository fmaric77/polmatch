#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';
const MONGO_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/pms';

console.log('🧪 Testing Group Message SSE Fix');
console.log('='.repeat(50));

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  setFromResponse(response) {
    const setCookieHeaders = response.headers.raw()['set-cookie'] || [];
    setCookieHeaders.forEach(cookie => {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      this.cookies.set(name.trim(), value.trim());
    });
  }

  getSessionToken() {
    return this.cookies.get('session');
  }
}

async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; test-client)',
      ...options.headers
    }
  });
  return response;
}

async function login() {
  console.log('🔐 Step 1: Logging in...');
  const cookieJar = new CookieJar();
  
  const response = await makeRequest(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sokol@example.com',
      password: 'mango'
    })
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  cookieJar.setFromResponse(response);
  const data = await response.json();
  
  console.log('✅ Login successful:', data.user.username);
  return { cookieJar, user: data.user };
}

async function setupSSE(sessionToken, username) {
  const { EventSource } = await import('eventsource');
  
  return new Promise((resolve, reject) => {
    const sseUrl = `${BASE_URL}/api/sse?sessionToken=${encodeURIComponent(sessionToken)}`;
    console.log(`📡 Setting up SSE for ${username}...`);
    
    const eventSource = new EventSource(sseUrl);
    const messages = [];

    eventSource.onopen = () => {
      console.log(`✅ SSE connected for ${username}`);
      resolve({ eventSource, messages });
    };

    eventSource.onerror = (error) => {
      console.error(`❌ SSE error for ${username}:`, error);
      reject(error);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`📨 ${username} received:`, data.type);
        messages.push(data);
      } catch (e) {
        console.log(`📨 ${username} received raw SSE:`, event.data);
        messages.push({ type: 'raw', data: event.data });
      }
    };

    setTimeout(() => {
      reject(new Error(`SSE connection timeout for ${username}`));
    }, 10000);
  });
}

async function findOrCreateTestGroup(cookieJar) {
  console.log('🔍 Step 2: Finding or creating test group...');
  
  // First, try to find existing groups
  const groupsResponse = await makeRequest(`${BASE_URL}/api/groups`, {
    headers: { 'Cookie': cookieJar.getCookieHeader() }
  });
  
  if (groupsResponse.ok) {
    const groupsData = await groupsResponse.json();
    if (groupsData.success && groupsData.groups && groupsData.groups.length > 0) {
      const testGroup = groupsData.groups[0];
      console.log(`✅ Using existing group: ${testGroup.name}`);
      return testGroup;
    }
  }

  // Create a new test group
  console.log('📝 Creating new test group...');
  const createResponse = await makeRequest(`${BASE_URL}/api/groups/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieJar.getCookieHeader()
    },
    body: JSON.stringify({
      name: 'SSE Test Group',
      description: 'Testing group message SSE notifications',
      topic: 'testing',
      is_private: false
    })
  });

  if (!createResponse.ok) {
    throw new Error(`Failed to create group: ${createResponse.status}`);
  }

  const data = await createResponse.json();
  console.log('✅ Created test group:', data.group.name);
  return data.group;
}

async function getGroupChannels(cookieJar, groupId) {
  console.log('📋 Step 3: Getting group channels...');
  
  const response = await makeRequest(`${BASE_URL}/api/groups/${groupId}/channels`, {
    headers: { 'Cookie': cookieJar.getCookieHeader() }
  });

  if (!response.ok) {
    throw new Error(`Failed to get channels: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success || !data.channels || data.channels.length === 0) {
    throw new Error('No channels found in group');
  }

  console.log(`✅ Found ${data.channels.length} channels`);
  return data.channels[0]; // Use the first channel
}

async function sendGroupMessage(cookieJar, groupId, channelId, content) {
  console.log('📤 Step 4: Sending group message...');
  
  const response = await makeRequest(`${BASE_URL}/api/groups/${groupId}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieJar.getCookieHeader()
    },
    body: JSON.stringify({
      content: content,
      attachments: []
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('✅ Message sent:', data.message.message_id);
  return data.message;
}

async function testGroupMessageSSE() {
  try {
    // Step 1: Login
    const { cookieJar, user } = await login();
    
    // Step 2: Setup SSE connection
    const sessionToken = cookieJar.getSessionToken();
    const sse = await setupSSE(sessionToken, user.username);
    
    // Step 3: Find or create test group
    const testGroup = await findOrCreateTestGroup(cookieJar);
    
    // Step 4: Get group channels
    const testChannel = await getGroupChannels(cookieJar, testGroup.group_id);
    
    // Step 5: Send a test message
    const messageContent = `Test group SSE message - ${new Date().toISOString()}`;
    const message = await sendGroupMessage(cookieJar, testGroup.group_id, testChannel.channel_id, messageContent);
    
    // Step 6: Wait for SSE notifications
    console.log('⏳ Step 5: Waiting for SSE notification...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 7: Analyze results
    console.log('\n📊 Test Results:');
    console.log(`- SSE Connection: ✅ Established`);
    console.log(`- Messages Received: ${sse.messages.length}`);
    
    sse.messages.forEach((msg, index) => {
      console.log(`  ${index + 1}. ${msg.type}: ${JSON.stringify(msg.data || msg).substring(0, 100)}...`);
    });

    const newMessageEvents = sse.messages.filter(msg => msg.type === 'NEW_MESSAGE');
    const groupMessageEvents = newMessageEvents.filter(msg => 
      msg.data && 
      msg.data.group_id === testGroup.group_id &&
      msg.data.channel_id === testChannel.channel_id &&
      msg.data.content === messageContent
    );

    if (groupMessageEvents.length > 0) {
      console.log('\n🎉 SUCCESS: Group message SSE notifications are working!');
      console.log('✅ Group message was received via SSE with correct structure');
      
      const groupMsg = groupMessageEvents[0].data;
      console.log('📋 Message details:');
      console.log(`  - Message ID: ${groupMsg.message_id}`);
      console.log(`  - Group ID: ${groupMsg.group_id}`);
      console.log(`  - Channel ID: ${groupMsg.channel_id}`);
      console.log(`  - Sender: ${groupMsg.sender_username || groupMsg.sender_id}`);
      console.log(`  - Content: ${groupMsg.content}`);
    } else if (newMessageEvents.length > 0) {
      console.log('\n⚠️  NEW_MESSAGE received but not for our group/channel');
      console.log('This might indicate a filtering issue or timing problem');
    } else {
      console.log('\n❌ FAILED: No NEW_MESSAGE SSE event received');
      console.log('The group message SSE fix may not be working correctly');
    }

    // Cleanup
    sse.eventSource.close();
    
    return groupMessageEvents.length > 0;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
testGroupMessageSSE()
  .then(success => {
    console.log('\n' + '='.repeat(50));
    if (success) {
      console.log('🎯 FINAL RESULT: GROUP MESSAGE SSE FIX IS WORKING! ✅');
    } else {
      console.log('🎯 FINAL RESULT: GROUP MESSAGE SSE FIX NEEDS MORE WORK ❌');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });
