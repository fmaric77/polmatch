#!/usr/bin/env node

// Test script to verify the frontend pin fix works correctly
// This script sends a message and then pins it using the correct message ID

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const cookies = 'session=4d75e8e3-4c2c-4547-8aeb-2b1245b37b3f; user_id=f47ac10b-58cc-4372-a567-0e02b2c3d479; profile_type=basic';

async function testUIPin() {
  console.log('🧪 Testing UI pin fix...');

  try {
    // First, send a message to the test group
    console.log('📤 Sending test message...');
    const messageResponse = await fetch(`${BASE_URL}/api/groups/ef347044-e0c7-4908-b290-013ddae18ad2/channels/b5857a1c-c393-4ba2-bf8c-c6ef411b24c8/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({
        content: `Test message for UI pin fix - ${Date.now()}`,
        profile_type: 'basic'
      })
    });

    const messageData = await messageResponse.json();
    if (!messageResponse.ok) {
      console.error('❌ Failed to send message:', messageData);
      return;
    }

    console.log('✅ Message sent successfully:', {
      message_id: messageData.message.message_id,
      content: messageData.message.content
    });

    // Now try to pin this message using the message_id (UUID, not ObjectId)
    console.log('📌 Attempting to pin message with UUID:', messageData.message.message_id);
    const pinResponse = await fetch(`${BASE_URL}/api/groups/ef347044-e0c7-4908-b290-013ddae18ad2/pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify({
        message_id: messageData.message.message_id, // Use the UUID
        channel_id: 'b5857a1c-c393-4ba2-bf8c-c6ef411b24c8',
        profile_type: 'basic'
      })
    });

    const pinData = await pinResponse.json();
    console.log('📌 Pin response:', {
      status: pinResponse.status,
      data: pinData
    });

    if (pinResponse.ok) {
      console.log('✅ Message pinned successfully with correct UUID!');
      
      // Verify the message is actually pinned
      console.log('🔍 Checking pinned messages...');
      const pinnedResponse = await fetch(`${BASE_URL}/api/groups/ef347044-e0c7-4908-b290-013ddae18ad2/pinned?profile_type=basic`, {
        headers: { 'Cookie': cookies }
      });
      
      const pinnedData = await pinnedResponse.json();
      console.log('📌 Pinned messages:', pinnedData.pinned_messages?.length || 0);
      
      const ourPinnedMessage = pinnedData.pinned_messages?.find(msg => msg.message_id === messageData.message.message_id);
      if (ourPinnedMessage) {
        console.log('✅ Message found in pinned messages:', {
          message_id: ourPinnedMessage.message_id,
          content: ourPinnedMessage.content,
          is_pinned: ourPinnedMessage.is_pinned,
          pinned_by: ourPinnedMessage.pinned_by
        });
        
        // Now unpin it
        console.log('📌 Unpinning message...');
        const unpinResponse = await fetch(`${BASE_URL}/api/groups/ef347044-e0c7-4908-b290-013ddae18ad2/pin`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookies
          },
          body: JSON.stringify({
            message_id: messageData.message.message_id,
            channel_id: 'b5857a1c-c393-4ba2-bf8c-c6ef411b24c8',
            profile_type: 'basic'
          })
        });
        
        const unpinData = await unpinResponse.json();
        console.log('📌 Unpin response:', {
          status: unpinResponse.status,
          data: unpinData
        });
        
        if (unpinResponse.ok) {
          console.log('✅ Message unpinned successfully!');
        } else {
          console.error('❌ Failed to unpin message');
        }
      } else {
        console.error('❌ Message not found in pinned messages');
      }
    } else {
      console.error('❌ Failed to pin message');
    }

  } catch (error) {
    console.error('❌ Error during test:', error);
  }
}

// Run the test
testUIPin().then(() => {
  console.log('🏁 Test completed');
}).catch(error => {
  console.error('💥 Test failed:', error);
});
