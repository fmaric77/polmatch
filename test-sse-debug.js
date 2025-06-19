// Simple test to check SSE connections and voice call notifications
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testSSEConnections() {
  console.log('🔍 Testing SSE Connections and Voice Call System...');
  
  try {
    // First, check if we can access the debug endpoint for SSE connections
    console.log('📊 Checking active SSE connections...');
    
    // We'll create an API endpoint to check active connections
    const response = await fetch(`${BASE_URL}/api/debug/sse-connections`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Active SSE connections:', data);
    } else {
      console.log('❌ Debug endpoint not available (status:', response.status, ')');
      console.log('ℹ️  We need to create the debug endpoint first');
    }
    
    // Test voice call notification directly
    console.log('📞 Testing voice call notification...');
    
    const callResponse = await fetch(`${BASE_URL}/api/voice-calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        channel_name: 'test-debug-channel',
        call_type: 'voice'
      })
    });
    
    const callData = await callResponse.json();
    console.log('📞 Voice call API response:', {
      status: callResponse.status,
      success: callResponse.ok,
      data: callData
    });
    
    // Test Agora token generation
    console.log('🎫 Testing Agora token generation...');
    
    const tokenResponse = await fetch(`${BASE_URL}/api/agora/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelName: 'test-debug-channel',
        uid: 'test-user-123'
      })
    });
    
    const tokenData = await tokenResponse.json();
    console.log('🎫 Agora token response:', {
      status: tokenResponse.status,
      success: tokenResponse.ok,
      hasToken: !!tokenData.token
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSSEConnections();
