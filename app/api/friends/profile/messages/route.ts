import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../../lib/mongodb-connection';
import { notifyNewMessage, notifyNewConversation } from '../../../../../lib/sse-notifications';
import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

interface ProfileMessage {
  _id?: string;
  conversation_id?: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachments: string[];
  profile_type: 'basic' | 'love' | 'business';
}

// Helper function to get sorted participant IDs for consistent conversation lookup
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// GET: Fetch profile-specific messages between two users
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
    const otherUserId = url.searchParams.get('user_id');
    const profileType = url.searchParams.get('profile_type') as 'basic' | 'love' | 'business';

    if (!otherUserId || !profileType) {
      return NextResponse.json({ 
        success: false, 
        message: 'user_id and profile_type are required' 
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

    // Check if users are friends in the specified profile type
    const friendship = await db.collection(collectionName).findOne({
      $or: [
        { user_id: userId, friend_id: otherUserId, status: 'accepted' },
        { user_id: otherUserId, friend_id: userId, status: 'accepted' }
      ]
    });

    if (!friendship) {
      return NextResponse.json({ 
        success: false, 
        message: `You are not friends with this user in ${profileType} profile` 
      }, { status: 403 });
    }

    // Get private conversation
    const sortedParticipants = getSortedParticipants(userId, otherUserId);
    const privateConversation = await db.collection('private_conversations').findOne({
      participant_ids: sortedParticipants
    });

    if (!privateConversation) {
      return NextResponse.json({ success: true, messages: [] });
    }

    // Fetch messages for this conversation
    const messages = await db.collection('pm').find({
      conversation_id: privateConversation._id
    }).sort({ timestamp: 1 }).toArray();

    // Decrypt messages
    const decryptedMessages = messages.map(msg => {
      try {
        const decryptedBytes = CryptoJS.AES.decrypt(msg.content, SECRET_KEY);
        const decryptedContent = decryptedBytes.toString(CryptoJS.enc.Utf8);
        return {
          ...msg,
          content: decryptedContent || '[Decryption failed]'
        };
      } catch {
        return {
          ...msg,
          content: '[Decryption failed]'
        };
      }
    });

    return NextResponse.json({ 
      success: true, 
      messages: decryptedMessages,
      profile_type: profileType
    });

  } catch (error) {
    console.error('Error fetching profile messages:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch messages' 
    }, { status: 500 });
  }
}

// POST: Send a profile-specific message
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
    const { receiver_id, content, profile_type, attachments = [] } = body as {
      receiver_id: string;
      content: string;
      profile_type: 'basic' | 'love' | 'business';
      attachments?: string[];
    };

    if (!receiver_id || !content || !profile_type) {
      return NextResponse.json({ 
        success: false, 
        message: 'receiver_id, content, and profile_type are required' 
      }, { status: 400 });
    }

    if (!['basic', 'love', 'business'].includes(profile_type)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    const userId = session.user_id;
    const collectionName = `friends_${profile_type}`;

    // Check if users are friends in the specified profile type
    const friendship = await db.collection(collectionName).findOne({
      $or: [
        { user_id: userId, friend_id: receiver_id, status: 'accepted' },
        { user_id: receiver_id, friend_id: userId, status: 'accepted' }
      ]
    });

    if (!friendship) {
      return NextResponse.json({ 
        success: false, 
        message: `You are not friends with this user in ${profile_type} profile` 
      }, { status: 403 });
    }

    // Verify receiver exists
    const receiver = await db.collection('users').findOne(
      { user_id: receiver_id },
      { projection: { user_id: 1 } }
    );
    if (!receiver) {
      return NextResponse.json({ success: false, message: 'Receiver not found' }, { status: 404 });
    }

    const now = new Date();
    const sortedParticipants = getSortedParticipants(userId, receiver_id);

    // Find or create private conversation using upsert
    const conversationResult = await db.collection('private_conversations').findOneAndUpdate(
      { participant_ids: sortedParticipants },
      { 
        $set: { updated_at: now },
        $setOnInsert: { 
          participant_ids: sortedParticipants, 
          created_at: now 
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    if (!conversationResult) {
      return NextResponse.json({ success: false, message: 'Failed to create conversation' }, { status: 500 });
    }

    // Encrypt the message content before saving
    const encryptedContent = CryptoJS.AES.encrypt(content, SECRET_KEY).toString();
    const message = {
      conversation_id: conversationResult._id,
      sender_id: userId,
      receiver_id,
      content: encryptedContent,
      timestamp: now.toISOString(),
      read: false,
      attachments,
      profile_type
    };

    const messageResult = await db.collection('pm').insertOne(message);

    // Check if this is a new conversation for SSE notification
    const isNewConversation = !await db.collection('private_conversations').findOne({
      participant_ids: sortedParticipants,
      created_at: { $ne: now }
    });

    // Send SSE notifications for real-time updates
    try {
      // Notify new message
      await notifyNewMessage({
        message_id: messageResult.insertedId.toString(),
        sender_id: userId,
        receiver_id,
        content,
        timestamp: now.toISOString(),
        conversation_participants: [userId, receiver_id]
      });

      // If it's a new conversation, notify about that too
      if (isNewConversation) {
        // Get the other user's details for the notification
        const otherUser = await db.collection('users').findOne(
          { user_id: receiver_id },
          { projection: { user_id: 1, username: 1 } }
        );

        if (otherUser) {
          await notifyNewConversation({
            conversation_id: conversationResult._id.toString(),
            participants: [userId, receiver_id],
            other_user: {
              user_id: otherUser.user_id,
              username: otherUser.username
            }
          });
        }
      }
    } catch (sseError) {
      console.error('Failed to send SSE notifications:', sseError);
      // Don't fail the message send if SSE fails
    }

    // Return the message with decrypted content for immediate display
    const responseMessage = {
      ...message,
      _id: messageResult.insertedId,
      content: content // Return original content for display
    };

    return NextResponse.json({ 
      success: true, 
      message: responseMessage,
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
