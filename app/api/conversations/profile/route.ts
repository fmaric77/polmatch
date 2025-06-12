import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';

const client = new MongoClient(MONGODB_URI);

type ProfileType = 'basic' | 'love' | 'business';

interface ProfileConversation {
  id: string;
  name: string;
  type: 'direct' | 'group';
  profile_type: ProfileType;
  other_user?: {
    user_id: string;
    username: string;
    display_name?: string;
    profile_picture_url?: string;
  };
  last_message?: {
    content: string;
    timestamp: string;
    sender_id: string;
  };
  created_at: string;
  updated_at: string;
  unread_count?: number;
}

// GET: Fetch profile-specific conversations for the current user
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const profileType = searchParams.get('profile_type') as ProfileType;

  if (!profileType || !['basic', 'love', 'business'].includes(profileType)) {
    return NextResponse.json({ 
      success: false, 
      message: 'Invalid or missing profile_type parameter' 
    }, { status: 400 });
  }

  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // Verify session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Invalid session' }, { status: 401 });
    }

    const userId = session.user_id;
    const conversations: ProfileConversation[] = [];

    // Get profile-specific private conversations
    const privateConversationsCollection = `private_conversations_${profileType}`;
    const privateMessagesCollection = `pm_${profileType}`;

    // Fetch private conversations for this profile type
    const privateConversations = await db.collection(privateConversationsCollection)
      .find({ participant_ids: userId })
      .sort({ updated_at: -1 })
      .toArray();

    for (const conv of privateConversations) {
      // Find the other user
      const otherUserId = conv.participant_ids.find((id: string) => id !== userId);
      if (!otherUserId) continue;

      // Get other user's basic data
      const otherUser = await db.collection('users').findOne({ user_id: otherUserId });
      if (!otherUser) continue;

      // Get other user's profile-specific data from the correct profile collection
      const profileCollectionName = `${profileType}profiles`;
      const otherUserProfile = await db.collection(profileCollectionName).findOne({
        user_id: otherUserId
      });

      // Get latest message for this conversation
      const latestMessage = await db.collection(privateMessagesCollection)
        .findOne(
          { 
            $or: [
              { sender_id: userId, receiver_id: otherUserId },
              { sender_id: otherUserId, receiver_id: userId }
            ]
          },
          { sort: { timestamp: -1 } }
        );

      conversations.push({
        id: otherUserId,
        name: otherUserProfile?.display_name || otherUser.username || otherUserId,
        type: 'direct',
        profile_type: profileType,
        other_user: {
          user_id: otherUserId,
          username: otherUser.username,
          display_name: otherUserProfile?.display_name,
          profile_picture_url: otherUserProfile?.profile_picture_url
        },
        last_message: latestMessage ? {
          content: latestMessage.content,
          timestamp: latestMessage.timestamp,
          sender_id: latestMessage.sender_id
        } : undefined,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        unread_count: 0 // TODO: Calculate unread count
      });
    }

    // TODO: Add profile-specific group conversations when groups support profile separation

    return NextResponse.json({
      success: true,
      conversations,
      profile_type: profileType
    });

  } catch (err) {
    console.error('Error fetching profile conversations:', err);
    return NextResponse.json({ 
      success: false, 
      message: 'Server error',
      error: String(err) 
    }, { status: 500 });
  }
}
