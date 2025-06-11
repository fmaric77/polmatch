const { MongoClient } = require('mongodb');
const CryptoJS = require('crypto-js');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';
const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

// Copy the exact functions from the API
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

async function testMessageRetrieval() {
  console.log('🧪 Testing Message Retrieval Logic Directly');
  console.log('=' * 50);

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('polmatch');

    // Test with the actual user IDs from the database
    const authUserId = 'cac15936-8de9-41a4-a041-4e19da78b016'; // User 1
    const otherUserId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'; // User 2
    
    console.log(`\\n🔍 Testing message retrieval for:`);
    console.log(`  Auth User: ${authUserId}`);
    console.log(`  Other User: ${otherUserId}`);

    // Test different profile type combinations
    const profileTests = [
      { sender: 'basic', receiver: 'basic' },
      { sender: 'love', receiver: 'love' },
      { sender: 'business', receiver: 'business' }
    ];

    for (const test of profileTests) {
      console.log(`\\n📋 Testing ${test.sender} ↔ ${test.receiver} conversation:`);
      
      const sortedParticipants = getSortedParticipants(authUserId, otherUserId);
      const profileContext = getProfileContext(test.sender, test.receiver, sortedParticipants, authUserId);
      
      console.log(`  Sorted Participants: ${JSON.stringify(sortedParticipants)}`);
      console.log(`  Profile Context: ${profileContext}`);
      
      // Determine collection
      const profileType = profileContext.split('_')[0];
      const primaryCollection = ['basic', 'love', 'business'].includes(profileType) ? `pm_${profileType}` : 'pm';
      console.log(`  Primary Collection: ${primaryCollection}`);
      
      // Search in profile-specific collection
      const profileSpecificQuery = {
        participant_ids: sortedParticipants,
        profile_context: profileContext
      };
      
      console.log(`  Profile Query: ${JSON.stringify(profileSpecificQuery)}`);
      
      try {
        const profileMessages = await db.collection(primaryCollection).find(profileSpecificQuery)
          .sort({ timestamp: -1 })
          .limit(50)
          .toArray();
        
        console.log(`  ✅ Profile Messages Found: ${profileMessages.length}`);
        
        if (profileMessages.length > 0) {
          profileMessages.forEach((msg, i) => {
            console.log(`    Message ${i + 1}:`);
            console.log(`      ID: ${msg._id}`);
            console.log(`      Profile Context: ${msg.profile_context}`);
            console.log(`      Participants: ${JSON.stringify(msg.participant_ids)}`);
            console.log(`      Sender: ${msg.sender_id}`);
            console.log(`      Timestamp: ${msg.timestamp}`);
            
            // Try to decrypt content
            try {
              const decryptedBytes = CryptoJS.AES.decrypt(msg.encrypted_content || msg.content, SECRET_KEY);
              const content = decryptedBytes.toString(CryptoJS.enc.Utf8);
              console.log(`      Content: ${content}`);
            } catch (error) {
              console.log(`      Content: [Failed to decrypt]`);
            }
          });
        }
        
        // Also check legacy messages
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
        
        console.log(`  📦 Legacy Messages Found: ${legacyMessages.length}`);
        
        const totalMessages = profileMessages.length + legacyMessages.length;
        console.log(`  📊 Total Messages: ${totalMessages}`);
        
      } catch (error) {
        console.log(`  ❌ Error querying collection ${primaryCollection}: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
  }
}

testMessageRetrieval();
