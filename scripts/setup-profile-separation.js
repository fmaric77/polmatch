const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

/**
 * Script to set up the database schema for complete profile separation
 * This implements the three separate identities: love, business, basic
 */
async function setupProfileSeparation() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('=== Setting up Profile Separation Database Schema ===');
    
    // 1. Create profile-specific friends collections
    console.log('1. Creating profile-specific friends collections...');
    
    const friendsCollections = ['friends_basic', 'friends_love', 'friends_business'];
    for (const collection of friendsCollections) {
      await db.collection(collection).createIndex({ user_id: 1, friend_id: 1, profile_type: 1 }, { unique: true });
      await db.collection(collection).createIndex({ user_id: 1, status: 1 });
      await db.collection(collection).createIndex({ friend_id: 1, status: 1 });
      console.log(`   ✓ Created indexes for ${collection}`);
    }
    
    // 2. Create profile-specific private conversations
    console.log('2. Creating profile-specific private conversations...');
    
    const conversationCollections = ['private_conversations_basic', 'private_conversations_love', 'private_conversations_business'];
    for (const collection of conversationCollections) {
      await db.collection(collection).createIndex({ participant_ids: 1 }, { unique: true });
      await db.collection(collection).createIndex({ updated_at: -1 });
      await db.collection(collection).createIndex({ created_at: -1 });
      console.log(`   ✓ Created indexes for ${collection}`);
    }
    
    // 3. Create profile-specific private messages
    console.log('3. Creating profile-specific private messages...');
    
    const messageCollections = ['pm_basic', 'pm_love', 'pm_business'];
    for (const collection of messageCollections) {
      await db.collection(collection).createIndex({ conversation_id: 1, timestamp: 1 });
      await db.collection(collection).createIndex({ sender_id: 1, timestamp: -1 });
      await db.collection(collection).createIndex({ receiver_id: 1, timestamp: -1 });
      await db.collection(collection).createIndex({ timestamp: -1 });
      await db.collection(collection).createIndex({ conversation_id: 1, read: 1 });
      console.log(`   ✓ Created indexes for ${collection}`);
    }
    
    // 4. Update existing catalogue to include profile type
    console.log('4. Updating user catalogues with profile type...');
    
    await db.collection('user_catalogues').createIndex({ owner_user_id: 1, catalogued_user_id: 1, profile_type: 1 }, { unique: true });
    await db.collection('user_catalogues').createIndex({ owner_user_id: 1, profile_type: 1, category: 1 });
    console.log('   ✓ Updated user_catalogues indexes');
    
    // 5. Create profile-specific search preferences
    console.log('5. Creating profile search preferences...');
    
    await db.collection('profile_search_preferences').createIndex({ user_id: 1, profile_type: 1 }, { unique: true });
    console.log('   ✓ Created profile_search_preferences collection');
    
    // 6. Sample data migration (if needed)
    console.log('6. Checking for existing data migration needs...');
    
    const existingFriends = await db.collection('friends').countDocuments();
    const existingMessages = await db.collection('pm').countDocuments();
    
    if (existingFriends > 0) {
      console.log(`   Found ${existingFriends} existing friends - these will need manual migration`);
      console.log('   Use the migrate-existing-relationships.js script to migrate them');
    }
    
    if (existingMessages > 0) {
      console.log(`   Found ${existingMessages} existing messages - these will need manual migration`);
      console.log('   Use the migrate-existing-messages.js script to migrate them');
    }
    
    console.log('\n=== Profile Separation Schema Setup Complete ===');
    console.log('Collections created:');
    friendsCollections.forEach(c => console.log(`   - ${c}`));
    conversationCollections.forEach(c => console.log(`   - ${c}`));
    messageCollections.forEach(c => console.log(`   - ${c}`));
    console.log('   - profile_search_preferences');
    console.log('   - user_catalogues (updated)');
    
  } catch (error) {
    console.error('Error setting up profile separation:', error);
  } finally {
    await client.close();
  }
}

setupProfileSeparation();
