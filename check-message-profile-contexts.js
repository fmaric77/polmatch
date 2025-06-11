const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function checkMessageProfileContexts() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('=== Checking Message Profile Contexts ===\n');
    
    // Get total messages
    const totalMessages = await db.collection('pm').countDocuments();
    console.log(`Total messages in database: ${totalMessages}`);
    
    // Get messages with profile_context
    const messagesWithContext = await db.collection('pm').countDocuments({
      profile_context: { $exists: true, $ne: null }
    });
    console.log(`Messages with profile_context: ${messagesWithContext}`);
    
    // Get messages without profile_context
    const messagesWithoutContext = await db.collection('pm').countDocuments({
      $or: [
        { profile_context: { $exists: false } },
        { profile_context: null }
      ]
    });
    console.log(`Messages without profile_context: ${messagesWithoutContext}`);
    
    // Sample messages with profile_context
    console.log('\n=== Sample Messages WITH Profile Context ===');
    const sampleWithContext = await db.collection('pm').find({
      profile_context: { $exists: true, $ne: null }
    }).limit(5).toArray();
    
    sampleWithContext.forEach((msg, index) => {
      console.log(`${index + 1}. Message ID: ${msg._id}`);
      console.log(`   Profile Context: ${msg.profile_context}`);
      console.log(`   Sender: ${msg.sender_id}`);
      console.log(`   Receiver: ${msg.receiver_id}`);
      console.log(`   Timestamp: ${msg.timestamp}`);
      console.log('');
    });
    
    // Sample messages without profile_context
    console.log('\n=== Sample Messages WITHOUT Profile Context ===');
    const sampleWithoutContext = await db.collection('pm').find({
      $or: [
        { profile_context: { $exists: false } },
        { profile_context: null }
      ]
    }).limit(5).toArray();
    
    sampleWithoutContext.forEach((msg, index) => {
      console.log(`${index + 1}. Message ID: ${msg._id}`);
      console.log(`   Profile Context: ${msg.profile_context || 'MISSING'}`);
      console.log(`   Sender: ${msg.sender_id}`);
      console.log(`   Receiver: ${msg.receiver_id}`);
      console.log(`   Timestamp: ${msg.timestamp}`);
      console.log('');
    });
    
    // Check profile contexts by type
    console.log('\n=== Profile Context Distribution ===');
    const contextCounts = await db.collection('pm').aggregate([
      { $match: { profile_context: { $exists: true, $ne: null } } },
      { $group: { _id: '$profile_context', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    
    contextCounts.forEach(ctx => {
      console.log(`${ctx._id}: ${ctx.count} messages`);
    });
    
    // Check recent messages
    console.log('\n=== Recent Messages (Last 10) ===');
    const recentMessages = await db.collection('pm').find()
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
      
    recentMessages.forEach((msg, index) => {
      console.log(`${index + 1}. ${msg.timestamp} - Profile: ${msg.profile_context || 'NONE'} - ${msg.sender_id} → ${msg.receiver_id}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkMessageProfileContexts().catch(console.error);
