const { MongoClient } = require('mongodb');

async function simpleTest() {
  const client = new MongoClient('mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/');
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('Testing message retrieval logic...');
    
    // Known user IDs from database
    const user1 = 'cac15936-8de9-41a4-a041-4e19da78b016';
    const user2 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const sortedParticipants = [user1, user2].sort();
    
    console.log('Participants:', sortedParticipants);
    
    // Test basic profile query
    const basicQuery = {
      participant_ids: sortedParticipants,
      profile_context: 'basic_basic'
    };
    
    console.log('Basic query:', JSON.stringify(basicQuery));
    
    const basicMessages = await db.collection('pm_basic').find(basicQuery).toArray();
    console.log('Basic messages found:', basicMessages.length);
    
    if (basicMessages.length > 0) {
      console.log('First basic message:', basicMessages[0]);
    }
    
    // Test love profile query
    const loveQuery = {
      participant_ids: sortedParticipants,
      profile_context: 'love_love'
    };
    
    console.log('Love query:', JSON.stringify(loveQuery));
    
    const loveMessages = await db.collection('pm_love').find(loveQuery).toArray();
    console.log('Love messages found:', loveMessages.length);
    
    if (loveMessages.length > 0) {
      console.log('First love message:', loveMessages[0]);
    }
    
  } finally {
    await client.close();
  }
}

simpleTest().catch(console.error);
