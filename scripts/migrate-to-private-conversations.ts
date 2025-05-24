import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

// Helper function to get sorted participant IDs for consistent conversation lookup
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

async function migrateMessagesToPrivateConversations() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('polmatch');
    
    console.log('Starting migration to private conversations system...');
    
    // Step 1: Get all existing messages
    const existingMessages = await db.collection('pm').find({}).toArray();
    console.log(`Found ${existingMessages.length} existing messages`);
    
    // Step 2: Group messages by conversation pairs
    const conversationPairs = new Map<string, any[]>();
    const conversationMetadata = new Map<string, { 
      participants: string[], 
      firstMessage: Date, 
      lastMessage: Date 
    }>();
    
    for (const message of existingMessages) {
      const { sender_id, receiver_id, timestamp } = message;
      const sortedParticipants = getSortedParticipants(sender_id, receiver_id);
      const conversationKey = sortedParticipants.join('_');
      
      if (!conversationPairs.has(conversationKey)) {
        conversationPairs.set(conversationKey, []);
        conversationMetadata.set(conversationKey, {
          participants: sortedParticipants,
          firstMessage: new Date(timestamp),
          lastMessage: new Date(timestamp)
        });
      }
      
      conversationPairs.get(conversationKey)!.push(message);
      
      // Update metadata
      const metadata = conversationMetadata.get(conversationKey)!;
      const messageTime = new Date(timestamp);
      if (messageTime < metadata.firstMessage) {
        metadata.firstMessage = messageTime;
      }
      if (messageTime > metadata.lastMessage) {
        metadata.lastMessage = messageTime;
      }
    }
    
    console.log(`Found ${conversationPairs.size} unique conversations`);
    
    // Step 3: Create private_conversations documents
    const privateConversations = new Map<string, any>();
    
    for (const [conversationKey, metadata] of conversationMetadata.entries()) {
      const privateConversationDoc = {
        participant_ids: metadata.participants,
        created_at: metadata.firstMessage,
        updated_at: metadata.lastMessage
      };
      
      const insertResult = await db.collection('private_conversations').insertOne(privateConversationDoc);
      privateConversations.set(conversationKey, {
        _id: insertResult.insertedId,
        ...privateConversationDoc
      });
      
      console.log(`Created private conversation for ${metadata.participants.join(' <-> ')}`);
    }
    
    // Step 4: Update all existing messages with conversation_id
    let updatedCount = 0;
    
    for (const [conversationKey, messages] of conversationPairs.entries()) {
      const privateConversation = privateConversations.get(conversationKey);
      
      for (const message of messages) {
        await db.collection('pm').updateOne(
          { _id: message._id },
          { $set: { conversation_id: privateConversation._id } }
        );
        updatedCount++;
      }
      
      console.log(`Updated ${messages.length} messages for conversation ${conversationKey}`);
    }
    
    console.log(`Migration completed! Updated ${updatedCount} messages and created ${privateConversations.size} private conversations`);
    
    // Step 5: Create indexes for the new collections
    console.log('Creating indexes...');
    
    // Index on private_conversations
    await db.collection('private_conversations').createIndex({ participant_ids: 1 });
    await db.collection('private_conversations').createIndex({ updated_at: -1 });
    
    // Index on pm collection for conversation_id
    await db.collection('pm').createIndex({ conversation_id: 1, timestamp: 1 });
    
    console.log('Indexes created successfully!');
    
    // Step 6: Verify migration
    console.log('Verifying migration...');
    
    const messagesWithoutConversationId = await db.collection('pm').countDocuments({ 
      conversation_id: { $exists: false } 
    });
    
    if (messagesWithoutConversationId > 0) {
      console.warn(`WARNING: ${messagesWithoutConversationId} messages still don't have conversation_id`);
    } else {
      console.log('✅ All messages now have conversation_id');
    }
    
    const totalPrivateConversations = await db.collection('private_conversations').countDocuments();
    console.log(`✅ Created ${totalPrivateConversations} private conversations`);
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
  }
}

// Run the migration
if (require.main === module) {
  migrateMessagesToPrivateConversations().catch(console.error);
}

export { migrateMessagesToPrivateConversations };
