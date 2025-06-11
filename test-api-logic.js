// Simple test to verify message retrieval works with the fixed API
const { MongoClient } = require('mongodb');

async function testAPILogic() {
  const client = new MongoClient('mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/');
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('🧪 Testing Fixed Message Retrieval Logic');
    console.log('=' + '='.repeat(45));
    
    // Simulate the API logic with the known user IDs
    const authUserId = 'cac15936-8de9-41a4-a041-4e19da78b016';
    const otherUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const senderProfileType = 'basic';
    const receiverProfileType = 'basic';
    
    // Copy the exact logic from the API
    function getSortedParticipants(userId1, userId2) {
      return [userId1, userId2].sort();
    }
    
    function getProfileContext(user1Profile, user2Profile, sortedParticipants, user1Id) {
      if (sortedParticipants[0] === user1Id) {
        return `${user1Profile}_${user2Profile}`;
      } else {
        return `${user2Profile}_${user1Profile}`;
      }
    }
    
    console.log(`\\n📋 Test Parameters:`);
    console.log(`  Auth User: ${authUserId}`);
    console.log(`  Other User: ${otherUserId}`);
    console.log(`  Sender Profile: ${senderProfileType}`);
    console.log(`  Receiver Profile: ${receiverProfileType}`);
    
    const sortedParticipants = getSortedParticipants(authUserId, otherUserId);
    const profileContext = getProfileContext(senderProfileType, receiverProfileType, sortedParticipants, authUserId);
    
    console.log(`  Sorted Participants: ${JSON.stringify(sortedParticipants)}`);
    console.log(`  Profile Context: ${profileContext}`);
    
    // Determine collection
    const profileType = profileContext.split('_')[0];
    const primaryCollection = ['basic', 'love', 'business'].includes(profileType) ? `pm_${profileType}` : 'pm';
    
    console.log(`  Primary Collection: ${primaryCollection}`);
    
    // Test the exact query that would be used
    const profileSpecificQuery = {
      participant_ids: sortedParticipants,
      profile_context: profileContext
    };
    
    console.log(`  Query: ${JSON.stringify(profileSpecificQuery)}`);
    
    // Execute the query
    const profileMessages = await db.collection(primaryCollection).find(profileSpecificQuery)
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    
    console.log(`\\n📊 Results:`);
    console.log(`  Profile Messages Found: ${profileMessages.length}`);
    
    if (profileMessages.length > 0) {
      console.log(`\\n📝 First Message Details:`);
      const msg = profileMessages[0];
      console.log(`    ID: ${msg._id}`);
      console.log(`    Sender: ${msg.sender_id}`);
      console.log(`    Receiver: ${msg.receiver_id}`);
      console.log(`    Profile Context: ${msg.profile_context}`);
      console.log(`    Participants: ${JSON.stringify(msg.participant_ids)}`);
      console.log(`    Timestamp: ${msg.timestamp}`);
    }
    
    // Test legacy messages too
    const legacyQuery = {
      participant_ids: sortedParticipants,
      $or: [
        { profile_context: { $exists: false } },
        { profile_context: null }
      ]
    };
    
    const legacyMessages = await db.collection('pm').find(legacyQuery)
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    
    console.log(`  Legacy Messages Found: ${legacyMessages.length}`);
    console.log(`  Total Messages: ${profileMessages.length + legacyMessages.length}`);
    
    if (profileMessages.length > 0) {
      console.log(`\\n✅ SUCCESS: Messages are being stored and can be retrieved correctly!`);
    } else {
      console.log(`\\n❌ ISSUE: No messages found with this query`);
      
      // Let's check what's actually in the database
      console.log(`\\n🔍 Debug: Checking what's in ${primaryCollection} collection:`);
      const allMessages = await db.collection(primaryCollection).find({}).toArray();
      console.log(`  Total messages in collection: ${allMessages.length}`);
      
      if (allMessages.length > 0) {
        console.log(`  Sample message:`, JSON.stringify(allMessages[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
  }
}

testAPILogic();
