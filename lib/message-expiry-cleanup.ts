import { connectToDatabase } from './mongodb-connection';

type ProfileType = 'basic' | 'love' | 'business';

interface MessageExpirySettings {
  user_id: string;
  profile_type: ProfileType;
  expiry_enabled: boolean;
  expiry_days: number;
  created_at: string;
  updated_at: string;
}

interface CleanupResult {
  deleted_count: number;
  collections_cleaned: string[];
}

/**
 * Clean expired messages for a specific user and profile type
 * This is called automatically when messages are loaded
 */
export async function cleanupExpiredMessages(
  userId: string, 
  profileType?: ProfileType
): Promise<CleanupResult> {
  try {
    const { db } = await connectToDatabase();
    
    let totalDeleted = 0;
    const collectionsProcessed: string[] = [];
    
    // Build query for expiry settings
    const settingsQuery: Record<string, unknown> = {
      user_id: userId,
      expiry_enabled: true
    };
    
    if (profileType) {
      settingsQuery.profile_type = profileType;
    }
    
    // Get active expiry settings for this user
    const expirySettings = await db.collection('message_expiry_settings')
      .find(settingsQuery)
      .toArray() as unknown as MessageExpirySettings[];
    
    if (expirySettings.length === 0) {
      return { deleted_count: 0, collections_cleaned: [] };
    }
    
    // Process each expiry setting
    for (const setting of expirySettings) {
      const { profile_type, expiry_days } = setting;
      
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - expiry_days);
      const cutoffISO = cutoffDate.toISOString();
      
      // Determine which collections to clean
      let messageCollection: string;
      let conversationCollection: string;
      
      if (['basic', 'love', 'business'].includes(profile_type)) {
        messageCollection = `pm_${profile_type}`;
        conversationCollection = `private_conversations_${profile_type}`;
      } else {
        messageCollection = 'pm';
        conversationCollection = 'private_conversations';
      }
      
      try {
        // Delete expired messages where the user is the sender
        const deleteQuery = {
          sender_id: userId,
          timestamp: { $lt: cutoffISO }
        };
        
        const deleteResult = await db.collection(messageCollection).deleteMany(deleteQuery);
        
        if (deleteResult.deletedCount > 0) {
          totalDeleted += deleteResult.deletedCount;
          collectionsProcessed.push(messageCollection);
          
          // Update conversation timestamps after message deletion
          // Find conversations that might need timestamp updates
          const affectedConversations = await db.collection(conversationCollection).find({
            participant_ids: userId
          }).toArray();
          
          for (const conversation of affectedConversations) {
            // Get the most recent message in this conversation
            const latestMessage = await db.collection(messageCollection).findOne(
              { 
                $or: [
                  { sender_id: { $in: conversation.participant_ids } },
                  { receiver_id: { $in: conversation.participant_ids } }
                ]
              },
              { sort: { timestamp: -1 } }
            );
            
            if (latestMessage) {
              // Update conversation with latest message timestamp
              await db.collection(conversationCollection).updateOne(
                { _id: conversation._id },
                { $set: { updated_at: latestMessage.timestamp } }
              );
            } else {
              // No messages left, but keep conversation record
              await db.collection(conversationCollection).updateOne(
                { _id: conversation._id },
                { $set: { updated_at: new Date().toISOString() } }
              );
            }
          }
        }
      } catch (error) {
        console.error(`Error cleaning messages for user ${userId} in ${profile_type}:`, error);
      }
    }
    
    return {
      deleted_count: totalDeleted,
      collections_cleaned: collectionsProcessed
    };
    
  } catch (error) {
    console.error('Error in cleanupExpiredMessages:', error);
    return { deleted_count: 0, collections_cleaned: [] };
  }
}

/**
 * Clean expired messages for multiple users (batch operation)
 * This can be used for occasional bulk cleanup
 */
export async function batchCleanupExpiredMessages(userIds: string[]): Promise<CleanupResult> {
  let totalDeleted = 0;
  const allCollections: string[] = [];
  
  for (const userId of userIds) {
    const result = await cleanupExpiredMessages(userId);
    totalDeleted += result.deleted_count;
    allCollections.push(...result.collections_cleaned);
  }
  
  return {
    deleted_count: totalDeleted,
    collections_cleaned: [...new Set(allCollections)] // Remove duplicates
  };
}