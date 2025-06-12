const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function fixPrivateConversationIndexes() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('🔧 Fixing private conversation indexes...\n');
    
    // Collections to fix
    const collections = [
      'private_conversations_basic',
      'private_conversations_love', 
      'private_conversations_business'
    ];
    
    for (const collectionName of collections) {
      console.log(`=== Fixing ${collectionName} ===`);
      
      try {
        // Check if collection exists
        const collectionExists = await db.listCollections({ name: collectionName }).hasNext();
        if (!collectionExists) {
          console.log(`Collection ${collectionName} does not exist, skipping...`);
          continue;
        }
        
        const collection = db.collection(collectionName);
        
        // Get current indexes
        const currentIndexes = await collection.indexes();
        console.log('Current indexes:', currentIndexes.map(idx => ({ name: idx.name, key: idx.key, unique: idx.unique })));
        
        // Drop the incorrect unique index on participant_ids
        try {
          await collection.dropIndex('participant_ids_1');
          console.log('✅ Dropped incorrect unique index on participant_ids');
        } catch (error) {
          if (error.message.includes('index not found')) {
            console.log('Index participant_ids_1 does not exist, skipping drop...');
          } else {
            console.log('Error dropping index:', error.message);
          }
        }
        
        // Create the correct compound unique index
        // This ensures the same two participants can't have multiple conversations of the same type
        try {
          await collection.createIndex(
            { participant_ids: 1 }, 
            { 
              unique: true,
              name: 'unique_participant_pair',
              partialFilterExpression: { participant_ids: { $size: 2 } }
            }
          );
          console.log('✅ Created correct compound unique index for participant pairs');
        } catch (error) {
          console.log('Error creating index:', error.message);
        }
        
        // Verify the new indexes
        const newIndexes = await collection.indexes();
        console.log('New indexes:', newIndexes.map(idx => ({ name: idx.name, key: idx.key, unique: idx.unique })));
        
      } catch (error) {
        console.error(`Error processing ${collectionName}:`, error);
      }
      
      console.log('');
    }
    
    console.log('🎉 Index fixing complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

fixPrivateConversationIndexes();
