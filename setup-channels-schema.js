const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

async function setupChannelsSchema() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('=== Setting up Channels Schema ===');
    
    // 1. Create indexes for the new group_channels collection
    console.log('Creating indexes for group_channels...');
    await db.collection('group_channels').createIndex({ group_id: 1 });
    await db.collection('group_channels').createIndex({ group_id: 1, name: 1 }, { unique: true });
    await db.collection('group_channels').createIndex({ created_at: -1 });
    
    // 2. Add channel_id field to existing group_messages (optional, for future messages)
    console.log('Updating group_messages schema...');
    // This will add the field to future documents; existing ones won't have it (backward compatible)
    await db.collection('group_messages').createIndex({ group_id: 1, channel_id: 1, timestamp: 1 });
    
    // 3. Check existing groups and create default channels for them
    console.log('Checking existing groups...');
    const existingGroups = await db.collection('groups').find({}).toArray();
    console.log(`Found ${existingGroups.length} existing groups`);
    
    for (const group of existingGroups) {
      // Check if this group already has channels
      const existingChannels = await db.collection('group_channels').find({ group_id: group.group_id }).toArray();
      
      if (existingChannels.length === 0) {
        console.log(`Creating default channel for group: ${group.name}`);
        
        // Create default "general" channel
        const defaultChannel = {
          channel_id: require('crypto').randomUUID(),
          group_id: group.group_id,
          name: 'general',
          description: 'General discussion',
          created_at: new Date(),
          created_by: group.creator_id,
          is_default: true,
          position: 0
        };
        
        await db.collection('group_channels').insertOne(defaultChannel);
        console.log(`Created default channel for group ${group.group_id}`);
      } else {
        console.log(`Group ${group.name} already has ${existingChannels.length} channels`);
      }
    }
    
    console.log('Schema setup completed successfully!');
    
  } catch (error) {
    console.error('Error setting up schema:', error);
  } finally {
    await client.close();
  }
}

setupChannelsSchema();
