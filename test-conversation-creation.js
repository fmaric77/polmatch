const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/social-platform';

async function testConversationCreation() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('🔍 Testing conversation creation logic...\n');
    
    // Check all private conversation collections
    const collections = [
      'private_conversations',
      'private_conversations_basic', 
      'private_conversations_love',
      'private_conversations_business'
    ];
    
    for (const collectionName of collections) {
      try {
        const count = await db.collection(collectionName).countDocuments();
        console.log(`📊 ${collectionName}: ${count} conversations`);
        
        if (count > 0) {
          // Show sample conversations
          const samples = await db.collection(collectionName)
            .find({})
            .limit(3)
            .project({ participant_ids: 1, profile_context: 1, created_at: 1 })
            .toArray();
          
          samples.forEach((conv, i) => {
            console.log(`   Sample ${i+1}: ${JSON.stringify({
              participants: conv.participant_ids,
              profile_context: conv.profile_context,
              created: conv.created_at?.toISOString()?.substring(0, 16)
            })}`);
          });
        }
        console.log();
      } catch (error) {
        console.log(`❌ ${collectionName}: Collection doesn't exist or error - ${error.message}\n`);
      }
    }
    
    // Check for any duplicate conversations between main and profile collections
    console.log('🔍 Checking for potential duplicates...\n');
    
    const mainConversations = await db.collection('private_conversations').find({}).toArray();
    
    for (const mainConv of mainConversations) {
      for (const profileType of ['basic', 'love', 'business']) {
        const profileCollectionName = `private_conversations_${profileType}`;
        
        try {
          const duplicate = await db.collection(profileCollectionName).findOne({
            participant_ids: mainConv.participant_ids
          });
          
          if (duplicate) {
            console.log(`⚠️  POTENTIAL DUPLICATE FOUND:`);
            console.log(`   Main collection: ${JSON.stringify(mainConv.participant_ids)} (${mainConv.profile_context || 'no context'})`);
            console.log(`   ${profileCollectionName}: ${JSON.stringify(duplicate.participant_ids)} (${duplicate.profile_context || 'no context'})`);
            console.log();
          }
        } catch (error) {
          // Collection doesn't exist, skip
        }
      }
    }
    
    console.log('✅ Conversation creation test completed');
    
  } catch (error) {
    console.error('❌ Error testing conversation creation:', error);
  } finally {
    await client.close();
  }
}

testConversationCreation();
