// Debug script to check what the group messages API is returning
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const LOGIN_EMAIL = 'sokol@example.com';
const LOGIN_PASSWORD = 'mango';

async function debugGroupMessages() {
  try {
    console.log('🔐 Logging in...');
    
    // Login first
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: LOGIN_EMAIL,
        password: LOGIN_PASSWORD
      })
    });
    
    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      return;
    }
    
    // Get the session cookie
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    const sessionCookie = setCookieHeader ? setCookieHeader.split(';')[0] : '';
    
    console.log('✅ Login successful');
    console.log('🍪 Session cookie:', sessionCookie);
    
    // First, let's get the list of groups
    console.log('📋 Fetching groups...');
    const groupsResponse = await fetch(`${BASE_URL}/api/groups`, {
      headers: {
        'Cookie': sessionCookie
      }
    });
    
    if (!groupsResponse.ok) {
      console.error('❌ Failed to fetch groups:', await groupsResponse.text());
      return;
    }
    
    const groupsData = await groupsResponse.json();
    console.log('📊 Groups data:', JSON.stringify(groupsData, null, 2));
    
    if (!groupsData.groups || groupsData.groups.length === 0) {
      console.log('❌ No groups found');
      return;
    }
    
    const firstGroup = groupsData.groups[0];
    console.log(`🎯 Testing group: ${firstGroup.name} (ID: ${firstGroup.group_id})`);
    
    // Test basic profile type first
    console.log('📨 Fetching group messages (basic profile)...');
    const messagesResponse = await fetch(`${BASE_URL}/api/groups/${firstGroup.group_id}/messages?profile_type=basic`, {
      headers: {
        'Cookie': sessionCookie
      }
    });
    
    if (!messagesResponse.ok) {
      console.error('❌ Failed to fetch messages:', await messagesResponse.text());
      return;
    }
    
    const messagesData = await messagesResponse.json();
    console.log('📊 Messages data:', JSON.stringify(messagesData, null, 2));
    
    if (messagesData.messages && messagesData.messages.length > 0) {
      console.log('\n🔍 Analyzing first few messages:');
      messagesData.messages.slice(0, 3).forEach((message, index) => {
        console.log(`\nMessage ${index + 1}:`);
        console.log(`  - sender_id: ${message.sender_id}`);
        console.log(`  - sender_username: ${message.sender_username}`);
        console.log(`  - sender_display_name: ${message.sender_display_name}`);
        console.log(`  - content: ${message.content?.substring(0, 50)}...`);
      });
    } else {
      console.log('❌ No messages found in group');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugGroupMessages();
