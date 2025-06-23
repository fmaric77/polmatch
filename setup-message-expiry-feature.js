const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

/**
 * Script to set up message expiry feature database collections and indexes
 */
async function setupMessageExpiryFeature() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('=== Setting up Message Expiry Feature ===');
    
    // 1. Create message_expiry_settings collection with indexes
    console.log('1. Setting up message_expiry_settings collection...');
    
    const expiryCollectionExists = await db.listCollections({ name: 'message_expiry_settings' }).toArray();
    if (expiryCollectionExists.length === 0) {
      await db.createCollection('message_expiry_settings');
      console.log('   ✓ Created message_expiry_settings collection');
    } else {
      console.log('   📋 message_expiry_settings collection already exists');
    }
    
    // Create indexes for message_expiry_settings
    const expiryIndexes = [
      { user_id: 1, profile_type: 1 }, // Unique constraint for user+profile combinations
      { expiry_enabled: 1 }, // For finding active expiry settings
      { user_id: 1 }, // For fetching all user's settings
      { created_at: -1 }, // For sorting by creation date
      { updated_at: -1 } // For sorting by last update
    ];
    
    for (const index of expiryIndexes) {
      try {
        const options = JSON.stringify(index) === JSON.stringify({ user_id: 1, profile_type: 1 }) 
          ? { unique: true } 
          : {};
        await db.collection('message_expiry_settings').createIndex(index, options);
        console.log(`   ✅ Created index on message_expiry_settings:`, JSON.stringify(index), options.unique ? '(UNIQUE)' : '');
      } catch (error) {
        if (error.code !== 85) { // Index already exists
          console.log(`   ⚠️  Error creating index on message_expiry_settings:`, error.message);
        } else {
          console.log(`   📋 Index already exists on message_expiry_settings:`, JSON.stringify(index));
        }
      }
    }
    
    // 2. Add expiry-related indexes to existing message collections
    console.log('\n2. Adding expiry indexes to message collections...');
    
    const messageCollections = ['pm', 'pm_basic', 'pm_love', 'pm_business'];
    
    for (const collectionName of messageCollections) {
      // Check if collection exists
      const collectionExists = await db.listCollections({ name: collectionName }).toArray();
      if (collectionExists.length === 0) {
        console.log(`   ⚠️  Collection ${collectionName} does not exist, skipping...`);
        continue;
      }
      
      console.log(`   Setting up indexes for ${collectionName}...`);
      
      // Indexes needed for efficient expiry cleanup
      const messageIndexes = [
        { sender_id: 1, timestamp: 1 }, // For finding user's messages by date
        { timestamp: 1 }, // For efficient date-based queries
        { sender_id: 1, timestamp: -1 } // For finding latest messages by sender
      ];
      
      for (const index of messageIndexes) {
        try {
          await db.collection(collectionName).createIndex(index);
          console.log(`     ✅ Created index on ${collectionName}:`, JSON.stringify(index));
        } catch (error) {
          if (error.code !== 85) { // Index already exists
            console.log(`     ⚠️  Error creating index on ${collectionName}:`, error.message);
          } else {
            console.log(`     📋 Index already exists on ${collectionName}:`, JSON.stringify(index));
          }
        }
      }
    }
    
    // 3. Add indexes to conversation collections for efficient updates
    console.log('\n3. Adding indexes to conversation collections...');
    
    const conversationCollections = [
      'private_conversations', 
      'private_conversations_basic', 
      'private_conversations_love', 
      'private_conversations_business'
    ];
    
    for (const collectionName of conversationCollections) {
      // Check if collection exists
      const collectionExists = await db.listCollections({ name: collectionName }).toArray();
      if (collectionExists.length === 0) {
        console.log(`   ⚠️  Collection ${collectionName} does not exist, skipping...`);
        continue;
      }
      
      console.log(`   Setting up indexes for ${collectionName}...`);
      
      // Indexes for efficient conversation updates after message cleanup
      const conversationIndexes = [
        { participant_ids: 1 }, // For finding conversations by participants
        { updated_at: -1 } // For sorting by last activity
      ];
      
      for (const index of conversationIndexes) {
        try {
          const options = JSON.stringify(index) === JSON.stringify({ participant_ids: 1 }) 
            ? { unique: true } 
            : {};
          await db.collection(collectionName).createIndex(index, options);
          console.log(`     ✅ Created index on ${collectionName}:`, JSON.stringify(index), options.unique ? '(UNIQUE)' : '');
        } catch (error) {
          if (error.code !== 85) { // Index already exists
            console.log(`     ⚠️  Error creating index on ${collectionName}:`, error.message);
          } else {
            console.log(`     📋 Index already exists on ${collectionName}:`, JSON.stringify(index));
          }
        }
      }
    }
    
    // 4. Create sample expiry settings for demonstration (optional)
    console.log('\n4. Setting up demo data...');
    
    const existingSettings = await db.collection('message_expiry_settings').countDocuments();
    if (existingSettings === 0) {
      console.log('   No existing expiry settings found. You can create settings through the UI.');
    } else {
      console.log(`   Found ${existingSettings} existing expiry settings.`);
    }
    
    console.log('\n=== Message Expiry Feature Setup Complete ===');
    console.log('\nFeature Components:');
    console.log('   - Database collections and indexes ✓');
    console.log('   - API endpoints: /api/profile/message-expiry ✓');
    console.log('   - Admin cleanup endpoint: /api/admin/cleanup-expired-messages ✓');
    console.log('   - React hook: useMessageExpiry ✓');
    console.log('   - UI component: MessageExpirySettings ✓');
    console.log('   - Integrated into profile page ✓');
    
    console.log('\nHow to use:');
    console.log('1. Users can configure expiry settings in Profile > Settings');
    console.log('2. Set up a daily cron job to call /api/admin/cleanup-expired-messages');
    console.log('3. Use Authorization header: Bearer ' + (process.env.CRON_SECRET || 'polmatch_cron_secret_2024'));
    
    console.log('\nExample cron job setup:');
    console.log('   0 2 * * * curl -X POST http://localhost:3000/api/admin/cleanup-expired-messages \\');
    console.log('     -H "Authorization: Bearer polmatch_cron_secret_2024"');
    
  } catch (error) {
    console.error('Error setting up message expiry feature:', error);
  } finally {
    await client.close();
  }
}

setupMessageExpiryFeature();