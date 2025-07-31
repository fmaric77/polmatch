const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI || 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function fixPrivateConversationsDuplicateKey() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('🔍 Diagnosing private_conversations duplicate key issue...\n');
    
    // Check all private conversation collections
    const collectionNames = [
      'private_conversations',
      'private_conversations_basic', 
      'private_conversations_love',
      'private_conversations_business'
    ];
    
    for (const collectionName of collectionNames) {
      console.log(`=== Checking ${collectionName} ===`);
      
      // Check if collection exists
      const collectionExists = await db.listCollections({ name: collectionName }).hasNext();
      if (!collectionExists) {
        console.log(`Collection ${collectionName} does not exist, skipping...\n`);
        continue;
      }
      
      const collection = db.collection(collectionName);
      
      // Check current indexes
      console.log('Current indexes:');
      const indexes = await collection.indexes();
      indexes.forEach(idx => {
        console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.unique ? '(UNIQUE)' : ''}`);
      });
      
      // Find documents with problematic participant_ids
      console.log('\n🔍 Checking for data issues...');
      
      // Find documents where participant_ids is not an array or doesn't have exactly 2 elements
      const invalidDocs = await collection.find({
        $or: [
          { participant_ids: { $not: { $type: "array" } } }, // Not an array
          { participant_ids: { $not: { $size: 2 } } } // Not exactly 2 elements
        ]
      }).toArray();
      
      console.log(`Found ${invalidDocs.length} documents with invalid participant_ids format`);
      
      if (invalidDocs.length > 0) {
        console.log('Invalid documents:');
        invalidDocs.forEach((doc, index) => {
          console.log(`  ${index + 1}. _id: ${doc._id}, participant_ids: ${JSON.stringify(doc.participant_ids)} (type: ${typeof doc.participant_ids})`);
        });
      }
      
      // Find potential duplicates (same participant pairs)
      console.log('\n🔍 Checking for duplicate participant pairs...');
      const duplicates = await collection.aggregate([
        {
          $group: {
            _id: "$participant_ids",
            count: { $sum: 1 },
            docs: { $push: { _id: "$_id", created_at: "$created_at" } }
          }
        },
        {
          $match: { count: { $gt: 1 } }
        }
      ]).toArray();
      
      console.log(`Found ${duplicates.length} sets of duplicate participant pairs`);
      
      if (duplicates.length > 0) {
        console.log('Duplicate groups:');
        duplicates.forEach((dup, index) => {
          console.log(`  ${index + 1}. participant_ids: ${JSON.stringify(dup._id)} (${dup.count} documents)`);
          dup.docs.forEach(doc => {
            console.log(`    - _id: ${doc._id}, created_at: ${doc.created_at}`);
          });
        });
      }
      
      // Get sample of valid documents
      const validDocs = await collection.find({
        participant_ids: { $type: "array", $size: 2 }
      }).limit(3).toArray();
      
      console.log(`\n✅ Sample of valid documents (${validDocs.length}):`);
      validDocs.forEach((doc, index) => {
        console.log(`  ${index + 1}. _id: ${doc._id}, participant_ids: ${JSON.stringify(doc.participant_ids)}`);
      });
      
      console.log('\n' + '='.repeat(50) + '\n');
    }
    
    console.log('🔧 RECOMMENDED FIXES:');
    console.log('1. Remove or fix documents with invalid participant_ids format');
    console.log('2. Remove duplicate conversations (keep the oldest one)');
    console.log('3. Recreate unique index after data cleanup');
    console.log('\nWould you like to proceed with automatic fixes? (This will modify your data)');
    
  } catch (error) {
    console.error('Error diagnosing database:', error);
  } finally {
    await client.close();
  }
}

async function applyFixes() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('🔧 Applying fixes to private_conversations collections...\n');
    
    const collectionNames = [
      'private_conversations',
      'private_conversations_basic', 
      'private_conversations_love',
      'private_conversations_business'
    ];
    
    for (const collectionName of collectionNames) {
      console.log(`=== Fixing ${collectionName} ===`);
      
      const collectionExists = await db.listCollections({ name: collectionName }).hasNext();
      if (!collectionExists) {
        console.log(`Collection ${collectionName} does not exist, skipping...\n`);
        continue;
      }
      
      const collection = db.collection(collectionName);
      
      // Step 1: Remove documents with invalid participant_ids
      console.log('Step 1: Removing documents with invalid participant_ids...');
      const deleteResult = await collection.deleteMany({
        $or: [
          { participant_ids: { $not: { $type: "array" } } },
          { participant_ids: { $not: { $size: 2 } } }
        ]
      });
      console.log(`Deleted ${deleteResult.deletedCount} invalid documents`);
      
      // Step 2: Remove duplicates (keep oldest)
      console.log('Step 2: Removing duplicate conversations...');
      const duplicates = await collection.aggregate([
        {
          $group: {
            _id: "$participant_ids",
            count: { $sum: 1 },
            docs: { $push: { _id: "$_id", created_at: "$created_at" } }
          }
        },
        {
          $match: { count: { $gt: 1 } }
        }
      ]).toArray();
      
      let removedDuplicates = 0;
      for (const dup of duplicates) {
        // Sort by created_at and keep the oldest
        const sortedDocs = dup.docs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const toDelete = sortedDocs.slice(1); // Remove all except the first (oldest)
        
        for (const doc of toDelete) {
          await collection.deleteOne({ _id: doc._id });
          removedDuplicates++;
        }
      }
      console.log(`Removed ${removedDuplicates} duplicate documents`);
      
      // Step 3: Drop and recreate unique index
      console.log('Step 3: Recreating unique index...');
      try {
        await collection.dropIndex('participant_ids_1');
        console.log('Dropped existing participant_ids index');
      } catch (error) {
        console.log('Index may not exist or already dropped');
      }
      
      try {
        await collection.createIndex(
          { participant_ids: 1 }, 
          { 
            unique: true,
            name: 'participant_ids_1'
          }
        );
        console.log('✅ Created unique index on participant_ids');
      } catch (error) {
        console.error('Error creating unique index:', error.message);
      }
      
      console.log('');
    }
    
    console.log('✅ Fix completed! Try sending direct messages now.');
    
  } catch (error) {
    console.error('Error applying fixes:', error);
  } finally {
    await client.close();
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--fix')) {
  applyFixes();
} else {
  fixPrivateConversationsDuplicateKey();
  console.log('\n💡 To apply fixes automatically, run: node fix-private-conversations-duplicate-key.js --fix');
} 