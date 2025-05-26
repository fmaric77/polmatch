import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import CryptoJS from 'crypto-js';
import { getAuthenticatedUser, connectToDatabase } from '../../../lib/mongodb-connection';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

interface ConversationDocument {
  _id: unknown;
  participant_ids: string[];
  created_at: Date;
  updated_at: Date;
}

interface UserDocument {
  user_id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  profile_picture?: string;
  [key: string]: unknown;
}

interface MessageDocument {
  _id: unknown;
  conversation_id: unknown;
  content: string;
  sender_id: string;
  timestamp: Date;
  [key: string]: unknown;
}

interface LatestMessageAggregate {
  _id: unknown;
  latestMessage: MessageDocument;
}

// Helper function to get sorted participant IDs
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// GET: Fetch all private conversations for the current user
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { db } = await connectToDatabase();

    // Get all private conversations where the user is a participant
    const privateConversations = await db.collection('private_conversations').find({
      participant_ids: auth.user.user_id
    }).sort({ updated_at: -1 }).toArray();

    if (privateConversations.length === 0) {
      return NextResponse.json({ success: true, conversations: [] });
    }

    // Get the other participant IDs
    const otherUserIds = (privateConversations as ConversationDocument[]).map((conv: ConversationDocument) => {
      return conv.participant_ids.find((id: string) => id !== auth.user.user_id);
    }).filter(Boolean);

    // Get user details for other participants
    const otherUsers = await db.collection('users').find({
      user_id: { $in: otherUserIds }
    }).toArray();

    // Create a map for quick lookup
    const userMap = new Map((otherUsers as unknown as UserDocument[]).map((u: UserDocument) => [u.user_id, u]));

    // Get the latest message for each conversation
    const conversationIds = (privateConversations as ConversationDocument[]).map((conv: ConversationDocument) => conv._id);
    const latestMessages = await db.collection('pm').aggregate([
      { $match: { conversation_id: { $in: conversationIds } } },
      { $sort: { timestamp: -1 } },
      { $group: { 
        _id: '$conversation_id', 
        latestMessage: { $first: '$$ROOT' } 
      }}
    ]).toArray();

    const messageMap = new Map((latestMessages as unknown as LatestMessageAggregate[]).map((msg: LatestMessageAggregate) => [msg._id?.toString(), msg.latestMessage]));

    // Format the response
    const conversations = (privateConversations as unknown as ConversationDocument[]).map((conv: ConversationDocument) => {
      const otherUserId = conv.participant_ids.find((id: string) => id !== auth.user.user_id);
      const otherUser = otherUserId ? userMap.get(otherUserId) : null;
      const latestMessage = messageMap.get(conv._id?.toString() ?? '');
      
      // Decrypt latest message content if it exists
      let decryptedLatestMessage = null;
      if (latestMessage) {
        try {
          const bytes = CryptoJS.AES.decrypt(latestMessage.content, SECRET_KEY);
          const decryptedContent = bytes.toString(CryptoJS.enc.Utf8) || '[Decryption failed]';
          decryptedLatestMessage = {
            ...latestMessage,
            content: decryptedContent
          };
        } catch {
          decryptedLatestMessage = {
            ...latestMessage,
            content: '[Decryption failed]'
          };
        }
      }
      
      return {
        id: conv._id,
        participant_ids: conv.participant_ids,
        other_user: otherUser ? {
          user_id: otherUser.user_id,
          username: otherUser.username,
          first_name: otherUser.first_name,
          last_name: otherUser.last_name,
          profile_picture: otherUser.profile_picture
        } : null,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        latest_message: decryptedLatestMessage
      };
    }).filter(conv => conv.other_user !== null); // Filter out conversations where other user doesn't exist

    return NextResponse.json({ success: true, conversations });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  }
}

// POST: Create a private conversation (used when starting a new conversation from search)
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { db } = await connectToDatabase();

    const body = await request.json();
    const { other_user_id } = body;
    
    if (!other_user_id) {
      return NextResponse.json({ success: false, message: 'Missing other_user_id' }, { status: 400 });
    }

    // Verify the other user exists
    const otherUser = await db.collection('users').findOne({ user_id: other_user_id });
    if (!otherUser) {
      return NextResponse.json({ success: false, message: 'Other user not found' }, { status: 404 });
    }

    const now = new Date();
    const sortedParticipants = getSortedParticipants(auth.user.user_id, other_user_id);

    // Find or create the private conversation document
    let privateConversation = await db.collection('private_conversations').findOne({
      participant_ids: sortedParticipants
    });

    if (!privateConversation) {
      // Create new private conversation
      const newConversation = {
        participant_ids: sortedParticipants,
        created_at: now,
        updated_at: now
      };
      const insertResult = await db.collection('private_conversations').insertOne(newConversation);
      privateConversation = { _id: insertResult.insertedId, ...newConversation };
    } else {
      // Update existing conversation's timestamp
      await db.collection('private_conversations').updateOne(
        { _id: privateConversation._id },
        { $set: { updated_at: now } }
      );
    }

    return NextResponse.json({ 
      success: true, 
      private_conversation_id: privateConversation._id,
      conversation: privateConversation
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  }
}

// PATCH: Update conversation metadata (e.g., when new messages are sent)
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { db } = await connectToDatabase();

    const body = await request.json();
    const { other_user_id } = body;
    
    if (!other_user_id) {
      return NextResponse.json({ success: false, message: 'Missing other_user_id' }, { status: 400 });
    }

    const now = new Date();
    const sortedParticipants = getSortedParticipants(auth.user.user_id, other_user_id);

    // Update private conversation timestamp
    const result = await db.collection('private_conversations').updateOne(
      { participant_ids: sortedParticipants },
      { $set: { updated_at: now } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  }
}
