const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function fixConversationData() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('🔧 Fixing conversation data structure...');
    
    // Check each conversation collection for messages that should be moved
    for (const profileType of ['basic', 'love', 'business']) {
      const collectionName = `private_conversations_${profileType}`;
      console.log(`\n=== Processing ${collectionName} ===`);
      
      // Find documents that look like messages (have encrypted_content, sender_id, etc.)
      const messages = await db.collection(collectionName).find({
        encrypted_content: { $exists: true },
        sender_id: { $exists: true },
        timestamp: { $exists: true }
      }).toArray();
      
      console.log(`Found ${messages.length} message documents in ${collectionName}`);
      
      if (messages.length > 0) {
        // Move these messages to the correct messages collection
        for (const message of messages) {
          console.log(`  Moving message ${message._id} to ${collectionName}`);
          
          // Insert into the same collection (since it's already structured correctly for messages)
          // We just need to ensure conversation metadata exists separately
          
          // Extract conversation info
          const conversationMetadata = {
            participant_ids: message.participant_ids,
            profile_context: message.profile_context,
            created_at: new Date(message.timestamp),
            updated_at: new Date(message.timestamp)
          };
          
          // Check if conversation metadata already exists
          const existingConversation = await db.collection(collectionName).findOne({
            participant_ids: message.participant_ids,
            profile_context: message.profile_context,
            encrypted_content: { $exists: false } // Only conversation metadata, not messages
          });
          
          if (!existingConversation) {
            console.log(`    Creating conversation metadata for ${message.participant_ids.join(' <-> ')}`);
            try {
              await db.collection(collectionName).insertOne(conversationMetadata);
            } catch (e) {
              if (e.code === 11000) {
                console.log(`    Conversation metadata already exists (duplicate key)`);
              } else {
                throw e;
              }
            }
          }
        }
      }
      
      // Find documents that look like conversation metadata (no encrypted_content, sender_id, etc.)
      const conversations = await db.collection(collectionName).find({
        encrypted_content: { $exists: false },
        sender_id: { $exists: false },
        participant_ids: { $exists: true }
      }).toArray();
      
      console.log(`Found ${conversations.length} conversation metadata documents in ${collectionName}`);
    }
    
    console.log('\n✅ Data structure fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing conversation data:', error);
  } finally {
    await client.close();
  }
}

fixConversationData().catch(console.error);
