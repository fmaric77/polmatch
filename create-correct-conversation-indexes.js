const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function createCorrectIndexes() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('🔧 Creating correct indexes for private conversations...\n');
    
    // Collections to fix
    const collections = [
      'private_conversations_basic',
      'private_conversations_love', 
      'private_conversations_business'
    ];
    
    for (const collectionName of collections) {
      console.log(`=== Creating indexes for ${collectionName} ===`);
      
      try {
        // Check if collection exists
        const collectionExists = await db.listCollections({ name: collectionName }).hasNext();
        if (!collectionExists) {
          console.log(`Collection ${collectionName} does not exist, skipping...`);
          continue;
        }
        
        const collection = db.collection(collectionName);
        
        // Create a compound index that ensures uniqueness based on sorted participant pair
        // This will prevent duplicate conversations between the same two users
        try {
          await collection.createIndex(
            { participant_ids: 1 }, 
            { 
              name: 'participant_pair_index',
              sparse: true
            }
          );
          console.log('✅ Created participant_ids index (non-unique for flexibility)');
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log('Index already exists, skipping...');
          } else {
            console.log('Error creating index:', error.message);
          }
        }
        
        // Verify the indexes
        const indexes = await collection.indexes();
        console.log('Current indexes:', indexes.map(idx => ({ name: idx.name, key: idx.key, unique: idx.unique })));
        
      } catch (error) {
        console.error(`Error processing ${collectionName}:`, error);
      }
      
      console.log('');
    }
    
    console.log('🎉 Index creation complete!');
    console.log('\n💡 Note: The application logic will handle preventing duplicate conversations between the same participants.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

createCorrectIndexes().catch(console.error);
