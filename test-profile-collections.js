const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function testProfileCollections() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('🔍 Testing Profile-Separated Message Collections');
    console.log('=' * 50);
    
    // Check if profile-specific collections exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('\n📂 Available Collections:');
    const profileCollections = ['pm', 'pm_basic', 'pm_love', 'pm_business'];
    profileCollections.forEach(name => {
      const exists = collectionNames.includes(name);
      console.log(`  ${exists ? '✅' : '❌'} ${name} ${exists ? '(exists)' : '(not found)'}`);
    });
    
    // Count messages in each collection
    console.log('\n📊 Message Counts by Collection:');
    for (const collectionName of profileCollections) {
      try {
        const count = await db.collection(collectionName).countDocuments({});
        console.log(`  ${collectionName}: ${count} messages`);
        
        // Show sample message with profile context if exists
        if (count > 0) {
          const sample = await db.collection(collectionName).findOne({});
          console.log(`    Sample profile_context: ${sample.profile_context || 'undefined'}`);
        }
      } catch (error) {
        console.log(`  ${collectionName}: Collection doesn't exist yet`);
      }
    }
    
    // Check for messages with profile_context in each collection
    console.log('\n🏷️  Profile Context Analysis:');
    for (const collectionName of profileCollections) {
      try {
        const withContext = await db.collection(collectionName).countDocuments({
          profile_context: { $exists: true, $ne: null }
        });
        const withoutContext = await db.collection(collectionName).countDocuments({
          $or: [
            { profile_context: { $exists: false } },
            { profile_context: null }
          ]
        });
        
        console.log(`  ${collectionName}:`);
        console.log(`    With profile_context: ${withContext}`);
        console.log(`    Without profile_context: ${withoutContext}`);
        
        if (withContext > 0) {
          // Show unique profile contexts
          const contexts = await db.collection(collectionName).distinct('profile_context');
          console.log(`    Unique contexts: ${contexts.filter(c => c).join(', ')}`);
        }
      } catch (error) {
        console.log(`  ${collectionName}: Error checking - ${error.message}`);
      }
    }
    
    console.log('\n✅ Profile Collections Test Complete');
    
  } catch (error) {
    console.error('❌ Error testing profile collections:', error);
  } finally {
    await client.close();
  }
}

testProfileCollections();
