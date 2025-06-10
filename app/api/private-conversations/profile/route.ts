import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';

type ProfileType = 'basic' | 'love' | 'business';

interface PrivateConversation {
  participant_ids: string[];
  created_at: string;
  updated_at: string;
  profile_type: ProfileType;
}

// Helper function to get sorted participant IDs for consistent conversation lookup
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// POST: Create or find a profile-specific private conversation
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
      profile_type: ProfileType 
    };

    if (!other_user_id || !profile_type) {
      return NextResponse.json({ 
        success: false, 
        message: 'other_user_id and profile_type are required' 
      }, { status: 400 });
    }

    if (!['basic', 'love', 'business'].includes(profile_type)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    const user_id = session.user_id;

    if (user_id === other_user_id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Cannot create conversation with yourself' 
      }, { status: 400 });
    }

    // Check if both users have the specified profile type
    const profileCollectionName = `${profile_type}profiles`;
    const [userProfile, otherUserProfile] = await Promise.all([
      db.collection(profileCollectionName).findOne({ user_id }),
      db.collection(profileCollectionName).findOne({ user_id: other_user_id })
    ]);

    if (!userProfile) {
      return NextResponse.json({ 
        success: false, 
        message: `You do not have a ${profile_type} profile` 
      }, { status: 400 });
    }

    if (!otherUserProfile) {
      return NextResponse.json({ 
        success: false, 
        message: `User does not have a ${profile_type} profile` 
      }, { status: 404 });
    }

    // Check if users are friends on this profile type
    const friendsCollectionName = `friends_${profile_type}`;
    const friendship = await db.collection(friendsCollectionName).findOne({
      $or: [
        { user_id, friend_id: other_user_id, status: 'accepted' },
        { user_id: other_user_id, friend_id: user_id, status: 'accepted' }
      ]
    });

    if (!friendship) {
      return NextResponse.json({ 
        success: false, 
        message: `You must be friends on ${profile_type} profile to start a conversation` 
      }, { status: 403 });
    }

    const sortedParticipants = getSortedParticipants(user_id, other_user_id);
    const conversationCollectionName = `private_conversations_${profile_type}`;
    
    // Find existing conversation
    let conversation = await db.collection(conversationCollectionName).findOne({
      participant_ids: sortedParticipants
    });

    if (!conversation) {
      // Create new conversation
      const now = new Date();
      const newConversation: PrivateConversation = {
        participant_ids: sortedParticipants,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        profile_type
      };
      
      const insertResult = await db.collection(conversationCollectionName).insertOne(newConversation);
      conversation = { _id: insertResult.insertedId, ...newConversation };
    }

    // Get other user info for display
    const otherUser = await db.collection('users').findOne(
      { user_id: other_user_id },
      { projection: { user_id: 1, username: 1 } }
    );

    return NextResponse.json({ 
      success: true, 
      conversation: {
        id: other_user_id, // Use other user ID as conversation identifier
        name: otherUserProfile.display_name || otherUser?.username || 'Unknown User',
        type: 'direct',
        profile_type,
        other_user: {
          user_id: other_user_id,
          username: otherUser?.username || 'Unknown',
          display_name: otherUserProfile.display_name || '',
          profile_picture_url: otherUserProfile.profile_picture_url || ''
        }
      }
    });

  } catch (error) {
    console.error('Error creating profile conversation:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to create conversation' 
    }, { status: 500 });
  }
}
