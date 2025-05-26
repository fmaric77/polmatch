const { MongoClient } = require('mongodb');

async function checkDatabases() {
  const client = new MongoClient('mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/');
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');
    
    // List all databases
    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    
    console.log('\n📊 Available databases:');
    for (const db of dbs.databases) {
      console.log(`- ${db.name} (${Math.round(db.sizeOnDisk / 1024 / 1024 * 100) / 100} MB)`);
    }
    
    // Check the 'polmatch' database specifically
    const polDb = client.db('polmatch');
    const collections = await polDb.listCollections().toArray();
    
    console.log('\n📋 Collections in "polmatch" database:');
    for (const collection of collections) {
      console.log(`- ${collection.name}`);
      
      // Check document count and indexes for each collection
      const coll = polDb.collection(collection.name);
      const count = await coll.countDocuments();
      const indexes = await coll.indexes();
      
      console.log(`  📊 Documents: ${count}`);
      console.log(`  🔍 Indexes: ${indexes.length}`);
      
      if (indexes.length > 1) { // More than just _id index
        console.log(`  📝 Index details:`);
        for (const index of indexes) {
          if (index.name !== '_id_') {
            const keys = Object.keys(index.key).join(', ');
            console.log(`    - ${index.name}: {${keys}}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkDatabases();
