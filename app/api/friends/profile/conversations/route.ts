import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../../lib/mongodb-connection';
import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

interface ProfileConversation {
  id: string;
  participant_ids: string[];
  other_user: {
    user_id: string;
    username: string;
    first_name?: string;
    last_name?: string;
    profile_picture?: string;
  };
  created_at: Date;
  updated_at: Date;
  latest_message?: {
    content: string;
    timestamp: string;
    sender_id: string;
  };
  profile_type: 'basic' | 'love' | 'business';
}

// Helper function to get sorted participant IDs
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// GET: Fetch profile-specific conversations for the current user
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    const url = new URL(request.url);
    const profileType = url.searchParams.get('profile_type') as 'basic' | 'love' | 'business';

    if (!profileType) {
      return NextResponse.json({ 
        success: false, 
        message: 'profile_type is required' 
      }, { status: 400 });
    }

    if (!['basic', 'love', 'business'].includes(profileType)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    const userId = session.user_id;
    const collectionName = `friends_${profileType}`;

    // Get all accepted friends for this profile type
    const friendships = await db.collection(collectionName).find({
      $or: [
        { user_id: userId, status: 'accepted' },
        { friend_id: userId, status: 'accepted' }
      ]
    }).toArray();

    if (friendships.length === 0) {
      return NextResponse.json({ success: true, conversations: [] });
    }

    // Extract friend IDs
    const friendIds = friendships.map(friendship => {
      return friendship.user_id === userId ? friendship.friend_id : friendship.user_id;
    });

    // Get user details for all friends
    const friends = await db.collection('users').find({
      user_id: { $in: friendIds }
    }).toArray();

    const userMap = new Map(friends.map(user => [user.user_id, user]));

    // Get all private conversations where user participates with these friends
    const conversationPromises = friendIds.map(async (friendId) => {
      const sortedParticipants = getSortedParticipants(userId, friendId);
      
      // Find the private conversation
      const privateConversation = await db.collection('private_conversations').findOne({
        participant_ids: sortedParticipants
      });

      if (!privateConversation) {
        return null; // No conversation exists with this friend
      }

      // Get the latest message for this conversation
      const latestMessage = await db.collection('pm').findOne(
        { conversation_id: privateConversation._id },
        { sort: { timestamp: -1 } }
      );

      const otherUser = userMap.get(friendId);
      if (!otherUser) {
        return null; // User not found
      }

      // Decrypt latest message if it exists
      let decryptedLatestMessage = null;
      if (latestMessage) {
        try {
          const bytes = CryptoJS.AES.decrypt(latestMessage.content, SECRET_KEY);
          const decryptedContent = bytes.toString(CryptoJS.enc.Utf8) || '[Decryption failed]';
          decryptedLatestMessage = {
            content: decryptedContent,
            timestamp: latestMessage.timestamp,
            sender_id: latestMessage.sender_id
          };
        } catch {
          decryptedLatestMessage = {
            content: '[Decryption failed]',
            timestamp: latestMessage.timestamp,
            sender_id: latestMessage.sender_id
          };
        }
      }

      return {
        id: privateConversation._id,
        participant_ids: privateConversation.participant_ids,
        other_user: {
          user_id: otherUser.user_id,
          username: otherUser.username,
          first_name: otherUser.first_name,
          last_name: otherUser.last_name,
          profile_picture: otherUser.profile_picture
        },
        created_at: privateConversation.created_at,
        updated_at: privateConversation.updated_at,
        latest_message: decryptedLatestMessage,
        profile_type: profileType
      };
    });

    const conversations = (await Promise.all(conversationPromises))
      .filter(conv => conv !== null) // Remove null conversations
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()); // Sort by latest activity

    return NextResponse.json({ 
      success: true, 
      conversations,
      profile_type: profileType
    });

  } catch (error) {
    console.error('Error fetching profile conversations:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch conversations' 
    }, { status: 500 });
  }
}
