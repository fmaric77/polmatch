const { MongoClient } = require('mongodb');
const fetch = require('node-fetch');

// Test direct message reply persistence
async function testDMReplyPersistence() {
  console.log('=== TESTING DM REPLY PERSISTENCE ===\n');
  
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // Login as sokol@example.com
    console.log('1. Logging in as sokol@example.com...');
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sokol@example.com',
        password: 'mango'
      })
    });
    
    const loginData = await loginRes.json();
    if (!loginData.success) {
      throw new Error('Login failed: ' + JSON.stringify(loginData));
    }
    
    const sessionCookie = loginRes.headers.get('set-cookie');
    console.log('✓ Login successful');
    
    // Get user info
    const sessionRes = await fetch('http://localhost:3000/api/session', {
      headers: { 'Cookie': sessionCookie }
    });
    const sessionData = await sessionRes.json();
    const currentUser = sessionData.user;
    console.log('✓ Current user:', currentUser.user_id, '(' + currentUser.username + ')');
    
    // Find another user to send messages to
    const users = await db.collection('users').find({
      user_id: { $ne: currentUser.user_id }
    }).limit(1).toArray();
    
    if (users.length === 0) {
      throw new Error('No other users found');
    }
    
    const otherUser = users[0];
    console.log('✓ Target user:', otherUser.user_id, '(' + otherUser.username + ')');
    
    // 2. Send original message
    console.log('\n2. Sending original message...');
    const originalMsgRes = await fetch('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': sessionCookie 
      },
      body: JSON.stringify({
        receiver_id: otherUser.user_id,
        content: 'This is the original message for reply test'
      })
    });
    
    const originalMsgData = await originalMsgRes.json();
    if (!originalMsgData.success) {
      throw new Error('Failed to send original message: ' + JSON.stringify(originalMsgData));
    }
    console.log('✓ Original message sent:', originalMsgData.message_id);
    
    // Wait a moment for the message to be saved
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 3. Fetch messages to get the message details for reply
    console.log('\n3. Fetching messages to prepare reply...');
    const messagesRes = await fetch(`http://localhost:3000/api/messages?user_id=${otherUser.user_id}`, {
      headers: { 'Cookie': sessionCookie }
    });
    
    const messagesData = await messagesRes.json();
    if (!messagesData.success || !messagesData.pms || messagesData.pms.length === 0) {
      throw new Error('Failed to fetch messages: ' + JSON.stringify(messagesData));
    }
    
    const originalMessage = messagesData.pms.find(msg => msg.content === 'This is the original message for reply test');
    if (!originalMessage) {
      throw new Error('Could not find original message in response');
    }
    
    console.log('✓ Found original message:', originalMessage._id);
    console.log('  Content:', originalMessage.content);
    
    // 4. Send reply message
    console.log('\n4. Sending reply message...');
    const replyMsgRes = await fetch('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': sessionCookie 
      },
      body: JSON.stringify({
        receiver_id: otherUser.user_id,
        content: 'This is a reply to the original message',
        reply_to: {
          message_id: originalMessage._id,
          content: originalMessage.content,
          sender_name: currentUser.username
        }
      })
    });
    
    const replyMsgData = await replyMsgRes.json();
    if (!replyMsgData.success) {
      throw new Error('Failed to send reply message: ' + JSON.stringify(replyMsgData));
    }
    console.log('✓ Reply message sent:', replyMsgData.message_id);
    
    // Wait a moment for the message to be saved
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 5. Verify reply was stored correctly in database
    console.log('\n5. Verifying reply in database...');
    
    // Check all possible collections for the reply message
    const collections = ['pm', 'pm_basic', 'pm_love', 'pm_business'];
    let replyFound = false;
    
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const replyInDB = await collection.findOne({
          _id: replyMsgData.message_id,
          sender_id: currentUser.user_id,
          receiver_id: otherUser.user_id
        });
        
        if (replyInDB) {
          console.log(`✓ Reply found in ${collectionName} collection:`);
          console.log('  Message ID:', replyInDB._id);
          console.log('  Content:', replyInDB.content || '[encrypted]');
          console.log('  Has reply_to field:', !!replyInDB.reply_to);
          
          if (replyInDB.reply_to) {
            console.log('  Reply details:');
            console.log('    Referenced message ID:', replyInDB.reply_to.message_id);
            console.log('    Referenced content:', replyInDB.reply_to.content);
            console.log('    Referenced sender:', replyInDB.reply_to.sender_name);
          } else {
            console.log('  ❌ No reply_to field found in database!');
          }
          
          replyFound = true;
          break;
        }
      } catch (error) {
        console.log(`Collection ${collectionName} does not exist or error: ${error.message}`);
      }
    }
    
    if (!replyFound) {
      console.log('❌ Reply message not found in any collection!');
    }
    
    // 6. Verify reply is returned by API
    console.log('\n6. Verifying reply is returned by API...');
    const finalMessagesRes = await fetch(`http://localhost:3000/api/messages?user_id=${otherUser.user_id}`, {
      headers: { 'Cookie': sessionCookie }
    });
    
    const finalMessagesData = await finalMessagesRes.json();
    if (!finalMessagesData.success) {
      throw new Error('Failed to fetch final messages: ' + JSON.stringify(finalMessagesData));
    }
    
    console.log('✓ API returned', finalMessagesData.pms.length, 'messages');
    
    // Find the reply message in the API response
    const replyFromAPI = finalMessagesData.pms.find(msg => 
      msg.content === 'This is a reply to the original message'
    );
    
    if (replyFromAPI) {
      console.log('✓ Reply message found in API response:');
      console.log('  Message ID:', replyFromAPI._id);
      console.log('  Content:', replyFromAPI.content);
      console.log('  Has reply_to field:', !!replyFromAPI.reply_to);
      
      if (replyFromAPI.reply_to) {
        console.log('  ✓ Reply details in API response:');
        console.log('    Referenced message ID:', replyFromAPI.reply_to.message_id);
        console.log('    Referenced content:', replyFromAPI.reply_to.content);
        console.log('    Referenced sender:', replyFromAPI.reply_to.sender_name);
      } else {
        console.log('  ❌ No reply_to field in API response!');
        console.log('  Raw message object:', JSON.stringify(replyFromAPI, null, 2));
      }
    } else {
      console.log('❌ Reply message not found in API response!');
      console.log('Available messages:');
      finalMessagesData.pms.forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.content} (ID: ${msg._id})`);
      });
    }
    
    console.log('\n=== TEST COMPLETE ===');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await client.close();
  }
}

// Check if we're running this script directly
if (require.main === module) {
  testDMReplyPersistence();
}

module.exports = { testDMReplyPersistence };
