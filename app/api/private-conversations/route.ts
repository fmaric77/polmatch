import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient, ObjectId } from 'mongodb';
import CryptoJS from 'crypto-js';

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';
const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

// Helper function to get sorted participant IDs
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// GET: Fetch all private conversations for the current user
export async function GET() {
  const client = new MongoClient(uri);
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    await client.connect();
    const db = client.db('polmatch');
    
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    // Get all private conversations where the user is a participant
    const privateConversations = await db.collection('private_conversations').find({
      participant_ids: user.user_id
    }).sort({ updated_at: -1 }).toArray();

    if (privateConversations.length === 0) {
      return NextResponse.json({ success: true, conversations: [] });
    }

    // Get the other participant IDs
    const otherUserIds = privateConversations.map(conv => {
      return conv.participant_ids.find((id: string) => id !== user.user_id);
    }).filter(Boolean);

    // Get user details for other participants
    const otherUsers = await db.collection('users').find({
      user_id: { $in: otherUserIds }
    }).toArray();

    // Create a map for quick lookup
    const userMap = new Map(otherUsers.map(u => [u.user_id, u]));

    // Get the latest message for each conversation
    const conversationIds = privateConversations.map(conv => conv._id);
    const latestMessages = await db.collection('pm').aggregate([
      { $match: { conversation_id: { $in: conversationIds } } },
      { $sort: { timestamp: -1 } },
      { $group: { 
        _id: '$conversation_id', 
        latestMessage: { $first: '$$ROOT' } 
      }}
    ]).toArray();

    const messageMap = new Map(latestMessages.map(msg => [msg._id.toString(), msg.latestMessage]));

    // Format the response
    const conversations = privateConversations.map(conv => {
      const otherUserId = conv.participant_ids.find((id: string) => id !== user.user_id);
      const otherUser = userMap.get(otherUserId);
      const latestMessage = messageMap.get(conv._id.toString());
      
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
  } finally {
    await client.close();
  }
}

// POST: Create a private conversation (used when starting a new conversation from search)
export async function POST(request: Request) {
  const client = new MongoClient(uri);
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    await client.connect();
    const db = client.db('polmatch');
    
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

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
    const sortedParticipants = getSortedParticipants(user.user_id, other_user_id);

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
  } finally {
    await client.close();
  }
}

// PATCH: Update conversation metadata (e.g., when new messages are sent)
export async function PATCH(request: Request) {
  const client = new MongoClient(uri);
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    await client.connect();
    const db = client.db('polmatch');
    
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { other_user_id } = body;
    
    if (!other_user_id) {
      return NextResponse.json({ success: false, message: 'Missing other_user_id' }, { status: 400 });
    }

    const now = new Date();
    const sortedParticipants = getSortedParticipants(user.user_id, other_user_id);

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
  } finally {
    await client.close();
  }
}
