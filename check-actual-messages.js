const { MongoClient } = require('mongodb');

async function checkMessages() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('chatApp');
    
    // Get all groups first
    const groups = await db.collection('groups').find({}).toArray();
    console.log('\n📁 Available Groups:');
    groups.forEach(group => {
      console.log(`- ${group.name} (${group._id})`);
    });
    
    // Get all group channels  
    const channels = await db.collection('group_channels').find({}).toArray();
    console.log('\n📺 Available Channels:');
    channels.forEach(channel => {
      console.log(`- ${channel.channel_name} (${channel._id}) - Group: ${channel.group_id}`);
    });
    
    // Get all channel messages
    const channelMessages = await db.collection('channel_messages').find({}).sort({ timestamp: -1 }).limit(10).toArray();
    console.log('\n💬 Recent Channel Messages (last 10):');
    channelMessages.forEach(msg => {
      console.log(`- ID: ${msg._id}`);
      console.log(`  message_id: ${msg.message_id}`);
      console.log(`  channel_id: ${msg.channel_id}`);
      console.log(`  content: ${msg.content?.substring(0, 50)}...`);
      console.log(`  timestamp: ${msg.timestamp}`);
      console.log('---');
    });
    
    // Check if we have a specific group/channel to focus on
    if (groups.length > 0 && channels.length > 0) {
      const firstGroup = groups[0];
      const firstChannel = channels[0];
      
      console.log(`\n🎯 Focusing on Group: ${firstGroup.name}, Channel: ${firstChannel.channel_name}`);
      
      const specificMessages = await db.collection('channel_messages').find({
        channel_id: firstChannel._id.toString()
      }).sort({ timestamp: -1 }).toArray();
      
      console.log(`Found ${specificMessages.length} messages in this channel:`);
      specificMessages.forEach(msg => {
        console.log(`- message_id: ${msg.message_id} | _id: ${msg._id}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkMessages();
