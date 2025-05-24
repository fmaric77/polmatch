// Test script to verify private conversations API
const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function testPrivateConversations() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('=== Testing Private Conversations Collection ===');
    
    // Check if private_conversations collection exists and has data
    const conversations = await db.collection('private_conversations').find({}).toArray();
    console.log('Total private conversations:', conversations.length);
    
    conversations.forEach((conv, index) => {
      console.log(`Conversation ${index + 1}:`, {
        id: conv._id,
        participants: conv.participant_ids,
        created: conv.created_at,
        updated: conv.updated_at
      });
    });
    
    // Check messages linked to conversations
    console.log('\n=== Checking Messages ===');
    for (const conv of conversations) {
      const messages = await db.collection('pm').find({
        conversation_id: conv._id
      }).toArray();
      console.log(`Conversation ${conv._id} has ${messages.length} messages`);
    }
    
    // Check users collection to see available users
    console.log('\n=== Available Users ===');
    const users = await db.collection('users').find({}, { 
      projection: { user_id: 1, username: 1, email: 1 } 
    }).toArray();
    console.log('Total users:', users.length);
    users.forEach(user => {
      console.log(`User: ${user.username} (${user.user_id})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testPrivateConversations();
