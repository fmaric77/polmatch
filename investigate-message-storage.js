const { MongoClient } = require('mongodb');

// MongoDB connection setup
const MONGODB_URI = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';
const DATABASE_NAME = 'polmatch';

async function investigateMessageStorage() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    
    // Check all message-related collections
    const collections = await db.listCollections().toArray();
    const messageCollections = collections
      .map(col => col.name)
      .filter(name => 
        name.includes('message') || 
        name === 'pm' || 
        name.startsWith('private_messages_')
      );
    
    console.log('\n📋 Available message collections:');
    messageCollections.forEach(col => console.log(`  - ${col}`));
    
    // Get recent messages from each collection to understand the storage pattern
    console.log('\n🔍 Investigating recent messages in each collection...\n');
    
    for (const collectionName of messageCollections) {
      try {
        const recentMessages = await db.collection(collectionName)
          .find({})
          .sort({ timestamp: -1 })
          .limit(5)
          .toArray();
        
        console.log(`\n📝 Collection: ${collectionName}`);
        console.log(`   Total documents: ${await db.collection(collectionName).countDocuments()}`);
        
        if (recentMessages.length > 0) {
          console.log('   Recent messages:');
          recentMessages.forEach((msg, idx) => {
            console.log(`     ${idx + 1}. Sender: ${msg.sender_id}, Receiver: ${msg.receiver_id}`);
            console.log(`        Profile Context: ${msg.profile_context || 'Not set'}`);
            console.log(`        Timestamp: ${msg.timestamp}`);
            console.log(`        Participants: ${JSON.stringify(msg.participant_ids)}`);
          });
        } else {
          console.log('   No messages found');
        }
      } catch (error) {
        console.log(`   ❌ Error accessing ${collectionName}: ${error.message}`);
      }
    }
    
    // Specifically look for basic profile messages
    console.log('\n\n🎯 SPECIFIC INVESTIGATION: Basic Profile Messages\n');
    
    // Check for messages with basic profile context
    const basicProfileQuery = {
      $or: [
        { profile_context: { $regex: /^basic_/ } },
        { profile_context: { $regex: /_basic$/ } },
        { profile_context: 'basic_basic' }
      ]
    };
    
    for (const collectionName of messageCollections) {
      try {
        const basicMessages = await db.collection(collectionName)
          .find(basicProfileQuery)
          .sort({ timestamp: -1 })
          .limit(10)
          .toArray();
        
        if (basicMessages.length > 0) {
          console.log(`📍 Found ${basicMessages.length} basic profile messages in ${collectionName}:`);
          basicMessages.forEach((msg, idx) => {
            console.log(`   ${idx + 1}. ${msg.sender_id} → ${msg.receiver_id}`);
            console.log(`      Profile Context: ${msg.profile_context}`);
            console.log(`      Time: ${msg.timestamp}`);
          });
          console.log('');
        }
      } catch (error) {
        console.log(`   ❌ Error searching ${collectionName}: ${error.message}`);
      }
    }
    
    // Check the most recent messages regardless of profile type
    console.log('\n📈 MOST RECENT MESSAGES (last 10 across all collections):\n');
    
    const allRecentMessages = [];
    
    for (const collectionName of messageCollections) {
      try {
        const messages = await db.collection(collectionName)
          .find({})
          .sort({ timestamp: -1 })
          .limit(10)
          .toArray();
        
        messages.forEach(msg => {
          allRecentMessages.push({
            ...msg,
            collection: collectionName
          });
        });
      } catch (error) {
        console.log(`Error accessing ${collectionName}: ${error.message}`);
      }
    }
    
    // Sort all messages by timestamp
    allRecentMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Show the most recent 10
    allRecentMessages.slice(0, 10).forEach((msg, idx) => {
      console.log(`${idx + 1}. Collection: ${msg.collection}`);
      console.log(`   ${msg.sender_id} → ${msg.receiver_id || 'N/A'}`);
      console.log(`   Profile Context: ${msg.profile_context || 'Not set'}`);
      console.log(`   Time: ${msg.timestamp}`);
      console.log(`   Participants: ${JSON.stringify(msg.participant_ids)}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Investigation error:', error);
  } finally {
    await client.close();
  }
}

// Run the investigation
investigateMessageStorage().catch(console.error);
