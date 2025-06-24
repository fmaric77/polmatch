import { Db } from 'mongodb';

interface UserProfile {
  user_id: string;
  message_expiry_days: number;
}

/**
 * Clean up expired messages for a specific user based on their profile settings
 * @param db MongoDB database instance
 * @param userId User ID to clean up messages for
 * @param profileType Profile type ('basic', 'love', 'business')
 */
export async function cleanupExpiredMessagesForUser(
  db: Db, 
  userId: string, 
  profileType: 'basic' | 'love' | 'business'
): Promise<{ deletedCount: number }> {
  try {
    // Get user's message expiry setting from their profile
    const profileCollection = profileType === 'basic' ? 'basicprofiles' : `${profileType}profiles`;
    const userProfile = await db.collection(profileCollection).findOne(
      { user_id: userId },
      { projection: { message_expiry_days: 1 } }
    ) as UserProfile | null;

    if (!userProfile || !userProfile.message_expiry_days) {
      return { deletedCount: 0 };
    }

    const expiryDays = userProfile.message_expiry_days;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - expiryDays);
    const cutoffTimestamp = cutoffDate.toISOString();

    console.log(`🧹 Cleaning up messages older than ${expiryDays} days for user ${userId} (${profileType} profile)`);
    console.log(`📅 Cutoff date: ${cutoffTimestamp}`);

    let totalDeleted = 0;

    // Clean up private messages
    const privateMessageCollections = profileType === 'basic' ? 
      ['pm', 'private_messages_basic'] : 
      [`private_messages_${profileType}`];

    for (const collection of privateMessageCollections) {
      try {
        const privateResult = await db.collection(collection).deleteMany({
          $or: [
            { sender_id: userId },
            { receiver_id: userId }
          ],
          timestamp: { $lt: cutoffTimestamp }
        });
        
        if (privateResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${privateResult.deletedCount} expired private messages from ${collection}`);
          totalDeleted += privateResult.deletedCount;
        }
      } catch {
        console.warn(`⚠️ Collection ${collection} may not exist, skipping...`);
      }
    }

    // Clean up group messages
    const groupMessageCollections = profileType === 'basic' ? 
      ['group_messages'] : 
      [`group_messages_${profileType}`];

    for (const collection of groupMessageCollections) {
      try {
        const groupResult = await db.collection(collection).deleteMany({
          sender_id: userId,
          timestamp: { $lt: cutoffTimestamp }
        });
        
        if (groupResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${groupResult.deletedCount} expired group messages from ${collection}`);
          totalDeleted += groupResult.deletedCount;
        }
      } catch {
        console.warn(`⚠️ Collection ${collection} may not exist, skipping...`);
      }
    }

    if (totalDeleted > 0) {
      console.log(`✅ Total deleted messages for user ${userId}: ${totalDeleted}`);
    }

    return { deletedCount: totalDeleted };
  } catch {
    console.error('❌ Error cleaning up expired messages:');
    return { deletedCount: 0 };
  }
}

/**
 * Clean up expired messages for all users in conversations with the current user
 * This ensures we respect everyone's expiry settings when loading messages
 * @param db MongoDB database instance
 * @param participantIds Array of user IDs in the conversation
 * @param profileType Profile type ('basic', 'love', 'business')
 */
export async function cleanupExpiredMessagesForConversation(
  db: Db,
  participantIds: string[],
  profileType: 'basic' | 'love' | 'business'
): Promise<{ totalDeletedCount: number }> {
  let totalDeleted = 0;

  for (const userId of participantIds) {
    const result = await cleanupExpiredMessagesForUser(db, userId, profileType);
    totalDeleted += result.deletedCount;
  }

  return { totalDeletedCount: totalDeleted };
}

/**
 * Clean up expired messages for a specific group conversation
 * This respects each member's individual expiry settings
 * @param db MongoDB database instance
 * @param groupId Group ID
 * @param profileType Profile type ('basic', 'love', 'business')
 */
export async function cleanupExpiredMessagesForGroup(
  db: Db,
  groupId: string,
  profileType: 'basic' | 'love' | 'business'
): Promise<{ totalDeletedCount: number }> {
  try {
    // Get all group members
    const membersCollection = profileType === 'basic' ? 'group_members' : `group_members_${profileType}`;
    const members = await db.collection(membersCollection)
      .find({ group_id: groupId })
      .project({ user_id: 1 })
      .toArray();

    const memberIds = members.map(member => member.user_id);
    return await cleanupExpiredMessagesForConversation(db, memberIds, profileType);
  } catch {
    console.error('❌ Error cleaning up expired group messages:');
    return { totalDeletedCount: 0 };
  }
}
