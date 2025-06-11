const { MongoClient } = require('mongodb');

async function setupMessageCollections() {
  const client = new MongoClient('mongodb://localhost:27017', {
    useUnifiedTopology: true,
  });

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('polmatch');
    
    // Profile types to create collections for
    const profileTypes = ['basic', 'love', 'business'];
    
    for (const profileType of profileTypes) {
      const messagesCollectionName = `private_messages_${profileType}`;
      const conversationsCollectionName = `private_conversations_${profileType}`;
      
      console.log(`\n🔧 Setting up ${messagesCollectionName} collection...`);
      
      // Create message collection if it doesn't exist
      const messageCollections = await db.listCollections({ name: messagesCollectionName }).toArray();
      if (messageCollections.length === 0) {
        await db.createCollection(messagesCollectionName);
        console.log(`✅ Created ${messagesCollectionName} collection`);
      } else {
        console.log(`📋 ${messagesCollectionName} collection already exists`);
      }
      
      // Create indexes for message collection
      const messageIndexes = [
        { participant_ids: 1, timestamp: -1 }, // For fetching messages
        { participant_ids: 1, profile_context: 1, timestamp: -1 }, // For profile-specific queries
        { sender_id: 1, receiver_id: 1, timestamp: -1 }, // For sender/receiver queries
        { timestamp: -1 }, // For general sorting
        { sender_id: 1, is_read: 1 } // For marking messages as read
      ];
      
      for (const index of messageIndexes) {
        try {
          await db.collection(messagesCollectionName).createIndex(index);
          console.log(`✅ Created index on ${messagesCollectionName}:`, JSON.stringify(index));
        } catch (error) {
          if (error.code !== 85) { // Index already exists
            console.log(`⚠️  Error creating index on ${messagesCollectionName}:`, error.message);
          } else {
            console.log(`📋 Index already exists on ${messagesCollectionName}:`, JSON.stringify(index));
          }
        }
      }
      
      console.log(`\n🔧 Setting up ${conversationsCollectionName} collection...`);
      
      // Create conversation collection if it doesn't exist
      const convCollections = await db.listCollections({ name: conversationsCollectionName }).toArray();
      if (convCollections.length === 0) {
        await db.createCollection(conversationsCollectionName);
        console.log(`✅ Created ${conversationsCollectionName} collection`);
      } else {
        console.log(`📋 ${conversationsCollectionName} collection already exists`);
      }
      
      // Create indexes for conversation collection (ensuring uniqueness for conversations)
      const conversationIndexes = [
        { participant_ids: 1, profile_context: 1 }, // Unique constraint for conversations
        { updated_at: -1 }, // For sorting by latest activity
        { participant_ids: 1 } // For finding conversations by participants
      ];
      
      for (const index of conversationIndexes) {
        try {
          // Make the first index unique to prevent duplicate conversations
          const options = (JSON.stringify(index) === JSON.stringify({ participant_ids: 1, profile_context: 1 })) ? { unique: true } : {};
          await db.collection(conversationsCollectionName).createIndex(index, options);
          console.log(`✅ Created index on ${conversationsCollectionName}:`, JSON.stringify(index), options.unique ? '(UNIQUE)' : '');
        } catch (error) {
          if (error.code !== 85) { // Index already exists
            console.log(`⚠️  Error creating index on ${conversationsCollectionName}:`, error.message);
          } else {
            console.log(`📋 Index already exists on ${conversationsCollectionName}:`, JSON.stringify(index));
          }
        }
      }
    }
    
    console.log('\n🎉 Message collection setup completed!');
    
  } catch (error) {
    console.error('Error setting up message collections:', error);
  } finally {
    await client.close();
  }
}

setupMessageCollections();
