import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';

type ProfileType = 'basic' | 'love' | 'business';

// Helper function to get sorted participant IDs for consistent conversation lookup
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// POST: Mark messages as read in a profile-specific conversation
export async function POST(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    
    // Verify session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { other_user_id, profile_type } = body as { 
      other_user_id: string; 
      profile_type?: ProfileType 
    };

    if (!other_user_id) {
      return NextResponse.json({ 
        success: false, 
        message: 'other_user_id is required' 
      }, { status: 400 });
    }

    const user_id = session.user_id;

    // Handle profile-specific messages if profile_type is provided
    if (profile_type) {
      if (!['basic', 'love', 'business'].includes(profile_type)) {
        return NextResponse.json({ 
          success: false, 
          message: 'Invalid profile_type. Must be basic, love, or business' 
        }, { status: 400 });
      }

      const sortedParticipants = getSortedParticipants(user_id, other_user_id);
      
      // Find the conversation for this profile type
      const conversationCollectionName = `private_conversations_${profile_type}`;
      const conversation = await db.collection(conversationCollectionName).findOne({
        participant_ids: sortedParticipants
      });

      if (!conversation) {
        return NextResponse.json({ 
          success: true, 
          message: 'No conversation found',
          marked_count: 0 
        });
      }

      // Mark all messages in this conversation as read where current user is receiver
      const messageCollectionName = `pm_${profile_type}`;
      const updateResult = await db.collection(messageCollectionName).updateMany(
        {
          conversation_id: conversation._id.toString(),
          receiver_id: user_id,
          read: false
        },
        {
          $set: { read: true }
        }
      );

      return NextResponse.json({ 
        success: true, 
        marked_count: updateResult.modifiedCount,
        profile_type 
      });
    } else {
      // Handle regular private messages (legacy)
      const updateResult = await db.collection('private_messages').updateMany(
        {
          sender_id: other_user_id,
          receiver_id: user_id,
          read: false
        },
        {
          $set: { read: true }
        }
      );

      return NextResponse.json({ 
        success: true, 
        marked_count: updateResult.modifiedCount 
      });
    }

  } catch (error) {
    console.error('Error marking messages as read:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to mark messages as read' 
    }, { status: 500 });
  }
}
