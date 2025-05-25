const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function testChannelMessaging() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('=== Testing Channel Messaging ===');
    
    // 1. Check if groups have channels
    console.log('\n1. Checking groups and their channels...');
    const groups = await db.collection('groups').find({}).toArray();
    console.log(`Found ${groups.length} groups`);
    
    for (const group of groups.slice(0, 3)) { // Check first 3 groups
      console.log(`\nGroup: ${group.name} (${group.group_id})`);
      
      const channels = await db.collection('group_channels').find({ group_id: group.group_id }).toArray();
      console.log(`  Channels: ${channels.length}`);
      
      channels.forEach(channel => {
        console.log(`    - ${channel.name} (${channel.channel_id}) ${channel.is_default ? '[DEFAULT]' : ''}`);
      });
      
      // Check messages in each channel
      for (const channel of channels) {
        const messages = await db.collection('group_messages').find({ 
          group_id: group.group_id, 
          channel_id: channel.channel_id 
        }).toArray();
        console.log(`    Messages in #${channel.name}: ${messages.length}`);
      }
      
      // Check messages without channel_id (old format)
      const oldMessages = await db.collection('group_messages').find({ 
        group_id: group.group_id, 
        channel_id: { $exists: false } 
      }).toArray();
      console.log(`    Old messages (no channel_id): ${oldMessages.length}`);
    }
    
    // 2. Check message structure
    console.log('\n2. Checking recent group messages structure...');
    const recentMessages = await db.collection('group_messages')
      .find({})
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();
    
    recentMessages.forEach((msg, index) => {
      console.log(`Message ${index + 1}:`);
      console.log(`  Group: ${msg.group_id}`);
      console.log(`  Channel: ${msg.channel_id || 'NO CHANNEL_ID'}`);
      console.log(`  Content: ${msg.content.substring(0, 50)}...`);
      console.log(`  Timestamp: ${msg.timestamp}`);
    });
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testChannelMessaging();
