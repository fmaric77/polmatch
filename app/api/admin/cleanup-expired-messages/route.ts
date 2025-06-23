import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb-connection';

// POST: Clean up expired messages based on user settings
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify this is called from an authorized source (cron job or admin)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'polmatch_cron_secret_2024';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    console.log('🧹 Starting message expiry cleanup job...');
    
    // Get all active expiry settings
    const expirySettings = await db.collection('message_expiry_settings').find({
      expiry_enabled: true
    }).toArray();

    if (expirySettings.length === 0) {
      console.log('ℹ️ No active message expiry settings found');
      return NextResponse.json({ 
        success: true, 
        message: 'No active expiry settings found',
        cleaned: 0
      });
    }

    let totalDeleted = 0;
    const cleanupResults: Array<{
      user_id: string;
      profile_type: string;
      deleted_count: number;
      collection: string;
    }> = [];

    // Process each user's expiry settings
    for (const setting of expirySettings) {
      const { user_id, profile_type, expiry_days } = setting;
      
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - expiry_days);
      const cutoffISO = cutoffDate.toISOString();
      
      console.log(`🗂️ Processing ${profile_type} messages for user ${user_id} (older than ${expiry_days} days)`);
      
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
          sender_id: user_id,
          timestamp: { $lt: cutoffISO }
        };

        const deleteResult = await db.collection(messageCollection).deleteMany(deleteQuery);
        
        if (deleteResult.deletedCount > 0) {
          console.log(`🗑️ Deleted ${deleteResult.deletedCount} expired messages from ${messageCollection} for user ${user_id}`);
          
          totalDeleted += deleteResult.deletedCount;
          cleanupResults.push({
            user_id,
            profile_type,
            deleted_count: deleteResult.deletedCount,
            collection: messageCollection
          });

          // Update conversation timestamps after message deletion
          // Find conversations that might need timestamp updates
          const affectedConversations = await db.collection(conversationCollection).find({
            participant_ids: user_id
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
        console.error(`❌ Error cleaning messages for user ${user_id} in ${profile_type}:`, error);
      }
    }

    console.log(`✅ Message expiry cleanup completed. Total deleted: ${totalDeleted} messages`);

    return NextResponse.json({ 
      success: true, 
      message: `Cleanup completed. Deleted ${totalDeleted} expired messages.`,
      cleaned: totalDeleted,
      results: cleanupResults
    });

  } catch (error) {
    console.error('❌ Error in message expiry cleanup:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to clean expired messages',
      error: String(error)
    }, { status: 500 });
  }
}