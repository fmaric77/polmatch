const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function testConversationCreation() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('🧪 Testing conversation creation...\n');
    
    // Test data - using some real user IDs from your database
    const user1 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'; // This user ID was mentioned in the error
    const user2 = 'cac15936-8de9-41a4-a041-4e19da78b016'; // Another user ID I saw in logs
    
    console.log(`Testing conversations between ${user1} and ${user2}`);
    
    // Test creating multiple conversation types between the same users
    const conversationTests = [
      { type: 'basic', collection: 'private_conversations_basic', context: 'basic_basic' },
      { type: 'love', collection: 'private_conversations_love', context: 'love_love' },
      { type: 'business', collection: 'private_conversations_business', context: 'business_business' }
    ];
    
    for (const test of conversationTests) {
      console.log(`\n=== Testing ${test.type} conversation ===`);
      
      const sortedParticipants = [user1, user2].sort();
      const now = new Date();
      
      // Try to create a conversation document
      const testConversation = {
        participant_ids: sortedParticipants,
        profile_context: test.context,
        created_at: now,
        updated_at: now
      };
      
      try {
        // Check if conversation already exists
        const existing = await db.collection(test.collection).findOne({
          participant_ids: sortedParticipants,
          profile_context: test.context
        });
        
        if (existing) {
          console.log(`✅ ${test.type} conversation already exists`);
        } else {
          // Try to insert new conversation
          const result = await db.collection(test.collection).insertOne(testConversation);
          console.log(`✅ ${test.type} conversation created successfully with ID: ${result.insertedId}`);
        }
        
      } catch (error) {
        if (error.message.includes('E11000')) {
          console.log(`❌ ${test.type} conversation failed - duplicate key error: ${error.message}`);
        } else {
          console.log(`❌ ${test.type} conversation failed: ${error.message}`);
        }
      }
    }
    
    // Show current conversations for these users
    console.log('\n=== Current conversations between these users ===');
    for (const test of conversationTests) {
      const conversations = await db.collection(test.collection).find({
        participant_ids: { $all: [user1, user2] }
      }).toArray();
      
      console.log(`${test.type}: ${conversations.length} conversation(s)`);
      conversations.forEach(conv => {
        console.log(`  - ID: ${conv._id}, Context: ${conv.profile_context}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testConversationCreation().catch(console.error);
