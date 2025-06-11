const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function testDeletionFix() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('🧪 Testing Conversation Deletion Fix\n');
    
    // Get two users for testing
    const users = await db.collection('users').find({}, { 
      projection: { user_id: 1, username: 1 } 
    }).limit(2).toArray();
    
    if (users.length < 2) {
      console.log('❌ Need at least 2 users for testing');
      return;
    }
    
    const [user1, user2] = users;
    console.log(`👥 Test users: ${user1.username} (${user1.user_id}) <-> ${user2.username} (${user2.user_id})\n`);
    
    // Helper function to get sorted participants
    function getSortedParticipants(userId1, userId2) {
      return [userId1, userId2].sort();
    }
    
    const sortedParticipants = getSortedParticipants(user1.user_id, user2.user_id);
    
    // 1. First, let's create some test conversations in different profile collections
    console.log('📝 Creating test conversations in profile-specific collections...');
    
    const now = new Date();
    const profileContexts = [
      { context: 'basic_basic', collection: 'private_conversations_basic' },
      { context: 'love_love', collection: 'private_conversations_love' },
      { context: 'business_business', collection: 'private_conversations_business' }
    ];
    
    // Create conversations in each profile collection
    for (const { context, collection } of profileContexts) {
      try {
        await db.collection(collection).insertOne({
          participant_ids: sortedParticipants,
          profile_context: context,
          created_at: now,
          updated_at: now
        });
        console.log(`✅ Created conversation in ${collection} with context: ${context}`);
      } catch (error) {
        console.log(`⚠️  Could not create conversation in ${collection}: ${error.message}`);
      }
    }
    
    // Also create a legacy conversation
    try {
      await db.collection('private_conversations').insertOne({
        participant_ids: sortedParticipants,
        created_at: now,
        updated_at: now
      });
      console.log('✅ Created legacy conversation in private_conversations');
    } catch (error) {
      console.log(`⚠️  Could not create legacy conversation: ${error.message}`);
    }
    
    console.log('\n📊 Current state BEFORE deletion:');
    
    // Check what conversations exist before deletion
    for (const { collection } of profileContexts) {
      try {
        const count = await db.collection(collection).countDocuments({ participant_ids: sortedParticipants });
        console.log(`   ${collection}: ${count} conversations`);
      } catch (error) {
        console.log(`   ${collection}: Collection doesn't exist or error: ${error.message}`);
      }
    }
    
    const legacyCount = await db.collection('private_conversations').countDocuments({ participant_ids: sortedParticipants });
    console.log(`   private_conversations (legacy): ${legacyCount} conversations`);
    
    // 2. Now test the DELETE endpoint with profile types (should target specific collection)
    console.log('\n🗑️  Testing profile-specific deletion (basic profile)...');
    
    const profileDeleteResponse = await fetch('http://localhost:3000/api/private-conversations', {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': 'session=test_session_token'
      },
      body: JSON.stringify({
        other_user_id: user2.user_id,
        sender_profile_type: 'basic',
        receiver_profile_type: 'basic'
      })
    });
    
    if (profileDeleteResponse.ok) {
      const profileDeleteData = await profileDeleteResponse.json();
      console.log('✅ Profile-specific deletion response:', profileDeleteData);
    } else {
      console.log('❌ Profile-specific deletion failed:', profileDeleteResponse.status, await profileDeleteResponse.text());
    }
    
    console.log('\n📊 State AFTER profile-specific deletion:');
    
    // Check what conversations exist after profile-specific deletion
    for (const { collection } of profileContexts) {
      try {
        const count = await db.collection(collection).countDocuments({ participant_ids: sortedParticipants });
        console.log(`   ${collection}: ${count} conversations`);
      } catch (error) {
        console.log(`   ${collection}: Collection doesn't exist or error: ${error.message}`);
      }
    }
    
    const legacyCountAfter = await db.collection('private_conversations').countDocuments({ participant_ids: sortedParticipants });
    console.log(`   private_conversations (legacy): ${legacyCountAfter} conversations`);
    
    // 3. Test comprehensive deletion (no profile types - should delete from all collections)
    console.log('\n🗑️  Testing comprehensive deletion (no profile types)...');
    
    const comprehensiveDeleteResponse = await fetch('http://localhost:3000/api/private-conversations', {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': 'session=test_session_token'
      },
      body: JSON.stringify({
        other_user_id: user2.user_id
        // No profile types - should delete from all collections
      })
    });
    
    if (comprehensiveDeleteResponse.ok) {
      const comprehensiveDeleteData = await comprehensiveDeleteResponse.json();
      console.log('✅ Comprehensive deletion response:', comprehensiveDeleteData);
    } else {
      console.log('❌ Comprehensive deletion failed:', comprehensiveDeleteResponse.status, await comprehensiveDeleteResponse.text());
    }
    
    console.log('\n📊 FINAL state after comprehensive deletion:');
    
    // Check final state - should be clean
    for (const { collection } of profileContexts) {
      try {
        const count = await db.collection(collection).countDocuments({ participant_ids: sortedParticipants });
        console.log(`   ${collection}: ${count} conversations`);
      } catch (error) {
        console.log(`   ${collection}: Collection doesn't exist or error: ${error.message}`);
      }
    }
    
    const finalLegacyCount = await db.collection('private_conversations').countDocuments({ participant_ids: sortedParticipants });
    console.log(`   private_conversations (legacy): ${finalLegacyCount} conversations`);
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
  }
}

testDeletionFix();
