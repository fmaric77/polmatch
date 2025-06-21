const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

/**
 * Script to set up profile-specific group collections
 * This extends the existing profile separation to include groups
 */
async function setupProfileGroups() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('=== Setting up Profile-Specific Group Collections ===');
    
    // 1. Create profile-specific group collections
    console.log('1. Creating profile-specific group collections...');
    
    const groupCollections = ['groups_love', 'groups_business'];
    for (const collection of groupCollections) {
      await db.collection(collection).createIndex({ group_id: 1 }, { unique: true });
      await db.collection(collection).createIndex({ creator_id: 1, creation_date: -1 });
      await db.collection(collection).createIndex({ is_private: 1, status: 1 });
      await db.collection(collection).createIndex({ profile_type: 1 });
      console.log(`   ✓ Created indexes for ${collection}`);
    }
    
    // 2. Create profile-specific group member collections
    console.log('2. Creating profile-specific group member collections...');
    
    const memberCollections = ['group_members_love', 'group_members_business'];
    for (const collection of memberCollections) {
      await db.collection(collection).createIndex({ group_id: 1, user_id: 1 }, { unique: true });
      await db.collection(collection).createIndex({ user_id: 1, join_date: -1 });
      await db.collection(collection).createIndex({ group_id: 1, role: 1 });
      await db.collection(collection).createIndex({ profile_type: 1 });
      console.log(`   ✓ Created indexes for ${collection}`);
    }
    
    // 3. Create profile-specific group channel collections
    console.log('3. Creating profile-specific group channel collections...');
    
    const channelCollections = ['group_channels_love', 'group_channels_business'];
    for (const collection of channelCollections) {
      await db.collection(collection).createIndex({ group_id: 1, name: 1 });
      await db.collection(collection).createIndex({ channel_id: 1 }, { unique: true });
      await db.collection(collection).createIndex({ group_id: 1, position: 1 });
      await db.collection(collection).createIndex({ profile_type: 1 });
      console.log(`   ✓ Created indexes for ${collection}`);
    }
    
    // 4. Create profile-specific group message collections
    console.log('4. Creating profile-specific group message collections...');
    
    const messageCollections = ['group_messages_love', 'group_messages_business'];
    for (const collection of messageCollections) {
      await db.collection(collection).createIndex({ group_id: 1, timestamp: 1 });
      await db.collection(collection).createIndex({ group_id: 1, channel_id: 1, timestamp: 1 });
      await db.collection(collection).createIndex({ message_id: 1 }, { unique: true });
      await db.collection(collection).createIndex({ sender_id: 1, timestamp: -1 });
      await db.collection(collection).createIndex({ timestamp: -1 });
      await db.collection(collection).createIndex({ profile_type: 1 });
      console.log(`   ✓ Created indexes for ${collection}`);
    }
    
    // 5. Create profile-specific group invitation collections
    console.log('5. Creating profile-specific group invitation collections...');
    
    const invitationCollections = ['group_invitations_love', 'group_invitations_business'];
    for (const collection of invitationCollections) {
      await db.collection(collection).createIndex({ group_id: 1, invited_user_id: 1 }, { unique: true });
      await db.collection(collection).createIndex({ invited_user_id: 1, status: 1 });
      await db.collection(collection).createIndex({ inviter_id: 1, created_at: -1 });
      await db.collection(collection).createIndex({ status: 1, created_at: -1 });
      await db.collection(collection).createIndex({ profile_type: 1 });
      console.log(`   ✓ Created indexes for ${collection}`);
    }
    
    // 6. Check existing data migration needs
    console.log('6. Checking for existing group data...');
    
    const existingGroups = await db.collection('groups').countDocuments();
    const existingGroupMembers = await db.collection('group_members').countDocuments();
    const existingGroupMessages = await db.collection('group_messages').countDocuments();
    
    if (existingGroups > 0) {
      console.log(`   Found ${existingGroups} existing groups - these will remain in the basic profile`);
      console.log('   New groups can be created with specific profile types');
    }
    
    if (existingGroupMembers > 0) {
      console.log(`   Found ${existingGroupMembers} existing group memberships - these will remain in basic profile`);
    }
    
    if (existingGroupMessages > 0) {
      console.log(`   Found ${existingGroupMessages} existing group messages - these will remain in basic profile`);
    }
    
    console.log('\n=== Profile-Specific Group Collections Setup Complete ===');
    console.log('New collections created:');
    groupCollections.forEach(c => console.log(`   - ${c}`));
    memberCollections.forEach(c => console.log(`   - ${c}`));
    channelCollections.forEach(c => console.log(`   - ${c}`));
    messageCollections.forEach(c => console.log(`   - ${c}`));
    invitationCollections.forEach(c => console.log(`   - ${c}`));
    
    console.log('\nHow to use:');
    console.log('- Create groups with profile_type parameter: "basic", "love", or "business"');
    console.log('- Groups without profile_type will default to "basic" and use existing collections');
    console.log('- Profile-specific groups will be stored in separate collections');
    console.log('- Users can only join groups that match their profile types');
    
  } catch (error) {
    console.error('Error setting up profile-specific groups:', error);
  } finally {
    await client.close();
  }
}

setupProfileGroups();