const { MongoClient } = require('mongodb');

async function checkMessageLocation() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // The message ID from the browser alert
    const messageId = '6837015746b59e57d9695776';
    
    console.log('🔍 Searching for message:', messageId);
    
    // Check all possible collections where messages might be stored
    const collections = [
      'group_messages',
      'channel_messages', 
      'messages',
      'pm'
    ];
    
    for (const collectionName of collections) {
      console.log(`\n📁 Checking collection: ${collectionName}`);
      
      try {
        const coll = db.collection(collectionName);
        
        // Check by different field patterns
        const searchPatterns = [
          { _id: messageId },
          { message_id: messageId },
          { _id: { $regex: messageId } },
          { message_id: { $regex: messageId } }
        ];
        
        for (const pattern of searchPatterns) {
          const result = await coll.findOne(pattern);
          if (result) {
            console.log(`✅ FOUND in ${collectionName} with pattern:`, pattern);
            console.log('Full message document:');
            console.log(JSON.stringify(result, null, 2));
            return;
          }
        }
        
        console.log(`   ❌ Not found in ${collectionName}`);
        
      } catch (error) {
        console.log(`   ⚠️  Error checking ${collectionName}:`, error.message);
      }
    }
    
    console.log('\n🔍 Let\'s also check recent messages to see what format they use...');
    
    // Check recent channel messages
    const recentChannelMessages = await db.collection('group_messages').find({}).sort({ timestamp: -1 }).limit(3).toArray();
    console.log('\n📝 Recent group_messages:');
    recentChannelMessages.forEach((msg, i) => {
      console.log(`Message ${i + 1}:`);
      console.log(`  _id: ${msg._id}`);
      console.log(`  message_id: ${msg.message_id}`);
      console.log(`  group_id: ${msg.group_id}`);
      console.log(`  channel_id: ${msg.channel_id}`);
      console.log(`  content: ${msg.content?.substring(0, 30)}...`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkMessageLocation();
