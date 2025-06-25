const { MongoClient } = require('mongodb');

// MongoDB connection string - update this with your actual connection string
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/polmatch';

async function setupMessageReactions() {
  let client;
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    console.log('✅ Connected to MongoDB');

    // Create message_reactions collection if it doesn't exist
    const collections = await db.listCollections({ name: 'message_reactions' }).toArray();
    if (collections.length === 0) {
      await db.createCollection('message_reactions');
      console.log('📝 Created message_reactions collection');
    } else {
      console.log('📝 message_reactions collection already exists');
    }

    // Create indexes for optimal query performance
    console.log('🔍 Creating indexes...');

    // Index for finding reactions by message
    await db.collection('message_reactions').createIndex(
      { message_id: 1, message_type: 1 },
      { background: true, name: 'message_reactions_lookup' }
    );

    // Index for finding user's reactions
    await db.collection('message_reactions').createIndex(
      { message_id: 1, message_type: 1, user_id: 1 },
      { background: true, name: 'user_message_reactions' }
    );

    // Index for finding reactions by user
    await db.collection('message_reactions').createIndex(
      { user_id: 1, created_at: -1 },
      { background: true, name: 'user_reactions_timeline' }
    );

    // Index for group message reactions
    await db.collection('message_reactions').createIndex(
      { group_id: 1, channel_id: 1, message_id: 1 },
      { background: true, name: 'group_message_reactions', sparse: true }
    );

    // Index for reaction type statistics
    await db.collection('message_reactions').createIndex(
      { reaction_type: 1, created_at: -1 },
      { background: true, name: 'reaction_type_stats' }
    );

    // Compound index for quick reaction toggles
    await db.collection('message_reactions').createIndex(
      { message_id: 1, user_id: 1, reaction_type: 1 },
      { unique: true, background: true, name: 'unique_user_message_reaction' }
    );

    console.log('✅ All indexes created successfully');

    // Insert some sample data for testing (optional)
    const sampleReactions = [
      {
        message_id: 'sample_message_1',
        message_type: 'group',
        user_id: 'sample_user_1',
        username: 'testuser1',
        reaction_type: '👍',
        group_id: 'sample_group_1',
        channel_id: 'sample_channel_1',
        created_at: new Date()
      },
      {
        message_id: 'sample_message_1',
        message_type: 'group',
        user_id: 'sample_user_2',
        username: 'testuser2',
        reaction_type: '❤️',
        group_id: 'sample_group_1',
        channel_id: 'sample_channel_1',
        created_at: new Date()
      }
    ];

    // Only insert sample data if the collection is empty
    const existingCount = await db.collection('message_reactions').countDocuments();
    if (existingCount === 0) {
      await db.collection('message_reactions').insertMany(sampleReactions);
      console.log('📊 Inserted sample reaction data for testing');
    }

    console.log('🎉 Message reactions setup completed successfully!');
    console.log('\n📋 Collection Structure:');
    console.log('- message_id: string (ID of the message being reacted to)');
    console.log('- message_type: "direct" | "group" (type of message)');
    console.log('- user_id: string (ID of user who reacted)');
    console.log('- username: string (username for display)');
    console.log('- reaction_type: string (emoji or reaction identifier)');
    console.log('- group_id: string (optional, for group messages)');
    console.log('- channel_id: string (optional, for channel messages)');
    console.log('- created_at: Date (when reaction was created)');

    console.log('\n🔗 Available API Endpoints:');
    console.log('- GET /api/messages/reactions?message_id=X&message_type=Y');
    console.log('- POST /api/messages/reactions (add/remove reaction)');
    console.log('- DELETE /api/messages/reactions (remove specific reaction)');

  } catch (error) {
    console.error('❌ Error setting up message reactions:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Run the setup
setupMessageReactions(); 