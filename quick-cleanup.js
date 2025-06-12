const { MongoClient } = require('mongodb');

async function quickCheck() {
  const client = new MongoClient('mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/');
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // Check the specific participants that are causing the error
    const testParticipants = ["cac15936-8de9-41a4-a041-4e19da78b016", "f47ac10b-58cc-4372-a567-0e02b2c3d479"].sort();
    
    console.log('Checking for duplicates with participants:', testParticipants);
    
    const businessDocs = await db.collection('private_conversations_business').find({
      participant_ids: testParticipants
    }).toArray();
    
    console.log('private_conversations_business documents:', businessDocs.length);
    businessDocs.forEach((doc, i) => {
      console.log(`  ${i+1}. ${doc._id} - Type: ${doc.encrypted_content ? 'MESSAGE' : 'CONVERSATION'}`);
      if (doc.profile_context) console.log(`     Profile context: ${doc.profile_context}`);
    });
    
    // Try to clean up: Remove messages that shouldn't be in conversation collections
    console.log('\nCleaning up messages from conversation collections...');
    
    const messagesToRemove = await db.collection('private_conversations_business').find({
      participant_ids: testParticipants,
      encrypted_content: { $exists: true }
    }).toArray();
    
    if (messagesToRemove.length > 0) {
      console.log(`Removing ${messagesToRemove.length} message documents from private_conversations_business`);
      const deleteResult = await db.collection('private_conversations_business').deleteMany({
        participant_ids: testParticipants,
        encrypted_content: { $exists: true }
      });
      console.log(`Deleted ${deleteResult.deletedCount} message documents`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.close();
  }
}

quickCheck().catch(console.error);
