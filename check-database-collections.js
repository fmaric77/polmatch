const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function checkDatabaseCollections() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('=== Database Collections ===');
    const collections = await db.listCollections().toArray();
    console.log('Total collections:', collections.length);
    
    for (const collection of collections) {
      console.log(`\nCollection: ${collection.name}`);
      
      // Count documents
      const count = await db.collection(collection.name).countDocuments();
      console.log(`Documents: ${count}`);
      
      // Show sample document
      if (count > 0) {
        const sample = await db.collection(collection.name).findOne();
        console.log('Sample document structure:', Object.keys(sample));
        
        // For groups-related collections, show more details
        if (collection.name.includes('group')) {
          console.log('Sample document:', JSON.stringify(sample, null, 2));
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkDatabaseCollections();
