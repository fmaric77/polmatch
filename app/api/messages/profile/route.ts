import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';

interface PrivateMessage {
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  encrypted_content?: string;
  timestamp: string;
  read: boolean;
  profile_type: 'basic' | 'love' | 'business';
  sender_profile_data: {
    display_name: string;
    profile_picture_url: string;
  };
}

interface PrivateConversation {
  participant_ids: string[];
  created_at: string;
  updated_at: string;
  profile_type: 'basic' | 'love' | 'business';
}

// Helper function to get sorted participant IDs for consistent conversation lookup
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// GET: Fetch messages for a specific profile type conversation
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
    const other_user_id = url.searchParams.get('other_user_id');
    const profile_type = url.searchParams.get('profile_type') as 'basic' | 'love' | 'business';
    const limit = parseInt(url.searchParams.get('limit') || '50');

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
    const sortedParticipants = getSortedParticipants(user_id, other_user_id);
    
    // Find the conversation for this profile type
    const conversationCollectionName = `private_conversations_${profile_type}`;
    const conversation = await db.collection(conversationCollectionName).findOne({
      participant_ids: sortedParticipants
    });

    if (!conversation) {
      return NextResponse.json({ 
        success: true, 
        messages: [],
        conversation: null,
        profile_type 
      });
    }

    // Get messages for this conversation
    const messageCollectionName = `pm_${profile_type}`;
    const rawMessages = await db.collection(messageCollectionName)
      .find({ conversation_id: conversation._id })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    // Reverse to get chronological order
    rawMessages.reverse();

    // Get unique sender IDs to fetch their profile data
    const senderIds = [...new Set(rawMessages.map(msg => msg.sender_id))];
    
    // Fetch profile data for all senders
    const senderProfiles = await db.collection('profiles')
      .find({ 
        user_id: { $in: senderIds },
        profile_type: profile_type
      })
      .toArray();

    // Create a map for quick lookup of sender profile data
    const senderProfileMap = new Map();
    senderProfiles.forEach(profile => {
      senderProfileMap.set(profile.user_id, {
        display_name: profile.display_name || '',
        profile_picture_url: profile.profile_picture_url || ''
      });
    });

    // Enhance messages with sender profile data
    const enhancedMessages = rawMessages.map(msg => ({
      ...msg,
      sender_profile_data: senderProfileMap.get(msg.sender_id) || {
        display_name: '',
        profile_picture_url: ''
      }
    }));

    return NextResponse.json({ 
      success: true, 
      messages: enhancedMessages,
      conversation,
      profile_type 
    });

  } catch (error) {
    console.error('Error fetching profile messages:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch messages' 
    }, { status: 500 });
  }
}

// POST: Send a message in a specific profile type conversation
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
    const { receiver_id, content, profile_type, reply_to } = body as { 
      receiver_id: string; 
      content: string; 
      profile_type: 'basic' | 'love' | 'business';
      reply_to?: {
        message_id: string;
        content: string;
        sender_name: string;
      }
    };

    if (!receiver_id || !content || !profile_type) {
      return NextResponse.json({ 
        success: false, 
        message: 'receiver_id, content, and profile_type are required' 
      }, { status: 400 });
    }

    // Validate reply_to if provided
    if (reply_to !== undefined) {
      if (typeof reply_to !== 'object' || reply_to === null) {
        return NextResponse.json({ 
          success: false, 
          message: 'reply_to must be an object' 
        }, { status: 400 });
      }
      
      const requiredReplyFields = ['message_id', 'content', 'sender_name'] as const;
      for (const field of requiredReplyFields) {
        if (!reply_to[field] || typeof reply_to[field] !== 'string') {
          return NextResponse.json({ 
            success: false, 
            message: `reply_to.${field} is required and must be a string` 
          }, { status: 400 });
        }
      }
      
      // Validate reply content length
      if (reply_to.content.length > 500) {
        return NextResponse.json({ 
          success: false, 
          message: 'reply_to.content too long (max 500 characters)' 
        }, { status: 400 });
      }
    }

    if (!['basic', 'love', 'business'].includes(profile_type)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    const sender_id = session.user_id;

    if (sender_id === receiver_id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Cannot send message to yourself' 
      }, { status: 400 });
    }

    // Check if both users have the specified profile type
    const profileCollectionName = `${profile_type}profiles`;
    const [senderProfile, receiverProfile] = await Promise.all([
      db.collection(profileCollectionName).findOne({ user_id: sender_id }),
      db.collection(profileCollectionName).findOne({ user_id: receiver_id })
    ]);

    if (!senderProfile) {
      return NextResponse.json({ 
        success: false, 
        message: `You do not have a ${profile_type} profile` 
      }, { status: 400 });
    }

    if (!receiverProfile) {
      return NextResponse.json({ 
        success: false, 
        message: `Recipient does not have a ${profile_type} profile` 
      }, { status: 404 });
    }

    // Check if users are friends on this profile type (optional - remove if you want to allow messages to non-friends)
    const friendsCollectionName = `friends_${profile_type}`;
    const friendship = await db.collection(friendsCollectionName).findOne({
      $or: [
        { user_id: sender_id, friend_id: receiver_id, status: 'accepted' },
        { user_id: receiver_id, friend_id: sender_id, status: 'accepted' }
      ]
    });

    if (!friendship) {
      return NextResponse.json({ 
        success: false, 
        message: `You must be friends on ${profile_type} profile to send messages` 
      }, { status: 403 });
    }

    const sortedParticipants = getSortedParticipants(sender_id, receiver_id);
    const now = new Date();
    const conversationCollectionName = `private_conversations_${profile_type}`;
    
    // Find or create conversation
    let conversation = await db.collection(conversationCollectionName).findOne({
      participant_ids: sortedParticipants
    });

    if (!conversation) {
      // Create new conversation
      const newConversation: PrivateConversation = {
        participant_ids: sortedParticipants,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        profile_type
      };
      
      const insertResult = await db.collection(conversationCollectionName).insertOne(newConversation);
      conversation = { _id: insertResult.insertedId, ...newConversation };
    } else {
      // Update conversation timestamp
      await db.collection(conversationCollectionName).updateOne(
        { _id: conversation._id },
        { $set: { updated_at: now.toISOString() } }
      );
    }

    // Create the message with sender profile data
    const message: PrivateMessage = {
      conversation_id: conversation._id.toString(),
      sender_id,
      receiver_id,
      content,
      timestamp: now.toISOString(),
      read: false,
      profile_type,
      sender_profile_data: {
        display_name: senderProfile.display_name || '',
        profile_picture_url: senderProfile.profile_picture_url || ''
      }
    };

    // Add reply_to information if provided
    if (reply_to) {
      (message as unknown as Record<string, unknown>).reply_to = {
        message_id: reply_to.message_id,
        content: reply_to.content,
        sender_name: reply_to.sender_name
      };
    }

    // Insert message into profile-specific collection
    const messageCollectionName = `pm_${profile_type}`;
    const messageResult = await db.collection(messageCollectionName).insertOne(message);

    return NextResponse.json({ 
      success: true, 
      message_id: messageResult.insertedId,
      conversation_id: conversation._id,
      profile_type 
    });

  } catch (error) {
    console.error('Error sending profile message:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to send message' 
    }, { status: 500 });
  }
}
