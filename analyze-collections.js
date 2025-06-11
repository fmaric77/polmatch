const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function analyzeCollections() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('🔍 Analyzing conversation collections...');
    
    // Check each profile-specific collection
    for (const profileType of ['basic', 'love', 'business']) {
      const collectionName = `private_conversations_${profileType}`;
      console.log(`\n=== ${collectionName} ===`);
      
      const allDocs = await db.collection(collectionName).find({}).toArray();
      console.log(`Total documents: ${allDocs.length}`);
      
      const messagesDocs = allDocs.filter(doc => doc.encrypted_content && doc.sender_id);
      const conversationDocs = allDocs.filter(doc => !doc.encrypted_content && !doc.sender_id && doc.participant_ids);
      
      console.log(`Message documents: ${messagesDocs.length}`);
      console.log(`Conversation metadata: ${conversationDocs.length}`);
      
      if (messagesDocs.length > 0) {
        console.log('Sample message doc:');
        console.log('  ID:', messagesDocs[0]._id);
        console.log('  Participants:', messagesDocs[0].participant_ids);
        console.log('  Profile context:', messagesDocs[0].profile_context);
        console.log('  Has encrypted content:', !!messagesDocs[0].encrypted_content);
      }
      
      if (conversationDocs.length > 0) {
        console.log('Sample conversation doc:');
        console.log('  ID:', conversationDocs[0]._id);
        console.log('  Participants:', conversationDocs[0].participant_ids);
        console.log('  Profile context:', conversationDocs[0].profile_context);
        console.log('  Created at:', conversationDocs[0].created_at);
      }
    }
    
    // Check if there are any duplicate participant_ids that might cause the error
    console.log('\n🔍 Checking for potential duplicate issues...');
    
    const testParticipants = ["cac15936-8de9-41a4-a041-4e19da78b016", "f47ac10b-58cc-4372-a567-0e02b2c3d479"].sort();
    
    for (const profileType of ['basic', 'love', 'business']) {
      const collectionName = `private_conversations_${profileType}`;
      const docs = await db.collection(collectionName).find({
        participant_ids: testParticipants
      }).toArray();
      
      console.log(`${collectionName}: ${docs.length} docs with participants [${testParticipants.join(', ')}]`);
      docs.forEach((doc, i) => {
        console.log(`  Doc ${i+1}: ${doc._id} - ${doc.encrypted_content ? 'MESSAGE' : 'CONVERSATION'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

analyzeCollections().catch(console.error);
