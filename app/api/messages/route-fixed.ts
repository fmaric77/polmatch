import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient, ObjectId } from 'mongodb';
import CryptoJS from 'crypto-js';

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';
const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

// Helper function to get sorted participant IDs for consistent conversation lookup
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// GET: Fetch messages for a specific conversation or all conversations for the user
export async function GET(request: Request) {
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
    
    const url = new URL(request.url);
    const otherUserId = url.searchParams.get('user_id');
    
    let pms;
    
    if (otherUserId) {
      // Fetch messages for a specific conversation
      // First check if this conversation is visible to the current user
      const conversationState = await db.collection('conversation_states').findOne({
        user_id: user.user_id,
        other_user_id: otherUserId,
        conversation_type: 'direct',
        state: 'visible'
      });
      
      if (!conversationState) {
        return NextResponse.json({ success: true, pms: [] }); // No visible conversation
      }
      
      // Get the private conversation
      const sortedParticipants = getSortedParticipants(user.user_id, otherUserId);
      const privateConversation = await db.collection('private_conversations').findOne({
        participant_ids: sortedParticipants
      });
      
      if (!privateConversation) {
        return NextResponse.json({ success: true, pms: [] }); // No conversation exists
      }
      
      // Fetch messages for this conversation
      pms = await db.collection('pm').find({
        conversation_id: privateConversation._id
      }).sort({ timestamp: 1 }).toArray();
      
    } else {
      // Fetch all messages for conversations visible to the user
      // Get visible conversation states
      const visibleStates = await db.collection('conversation_states').find({ 
        user_id: user.user_id, 
        conversation_type: 'direct',
        state: 'visible' 
      }).toArray();
      
      if (visibleStates.length === 0) {
        return NextResponse.json({ success: true, pms: [] });
      }
      
      // Get all private conversations for these states
      const otherUserIds = visibleStates.map(state => state.other_user_id);
      const conversationIds = [];
      
      for (const otherUserId of otherUserIds) {
        const sortedParticipants = getSortedParticipants(user.user_id, otherUserId);
        const privateConversation = await db.collection('private_conversations').findOne({
          participant_ids: sortedParticipants
        });
        if (privateConversation) {
          conversationIds.push(privateConversation._id);
        }
      }
      
      if (conversationIds.length === 0) {
        return NextResponse.json({ success: true, pms: [] });
      }
      
      // Fetch all messages for these conversations
      pms = await db.collection('pm').find({
        conversation_id: { $in: conversationIds }
      }).sort({ timestamp: -1 }).toArray();
    }
    
    // Decrypt message content before returning
    const decryptedPms = pms.map(msg => ({
      ...msg,
      content: (() => {
        try {
          const bytes = CryptoJS.AES.decrypt(msg.content, SECRET_KEY);
          return bytes.toString(CryptoJS.enc.Utf8) || '[Decryption failed]';
        } catch {
          return '[Decryption failed]';
        }
      })(),
    }));
    
    return NextResponse.json({ success: true, pms: decryptedPms });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}

// POST: Send a new message
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
    const { receiver_id, content, attachments } = body;
    if (!receiver_id || !content) return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
    
    // Verify receiver exists
    const receiver = await db.collection('users').findOne({ user_id: receiver_id });
    if (!receiver) return NextResponse.json({ success: false, message: 'Receiver not found' }, { status: 404 });
    
    const now = new Date();
    const sortedParticipants = getSortedParticipants(user.user_id, receiver_id);
    
    // Find or create private conversation
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
      // Update existing conversation
      await db.collection('private_conversations').updateOne(
        { _id: privateConversation._id },
        { $set: { updated_at: now } }
      );
    }
    
    // Encrypt the message content before saving
    const encryptedContent = CryptoJS.AES.encrypt(content, SECRET_KEY).toString();
    const message = {
      conversation_id: privateConversation._id,
      sender_id: user.user_id,
      receiver_id,
      content: encryptedContent,
      timestamp: now.toISOString(),
      read: false,
      attachments: attachments || [],
    };
    
    await db.collection('pm').insertOne(message);
    
    // Update conversation states for both users to ensure conversation is visible
    const participants = [user.user_id, receiver_id];
    
    for (const participant of participants) {
      const otherParticipant = participant === user.user_id ? receiver_id : user.user_id;
      
      await db.collection('conversation_states').updateOne(
        { 
          user_id: participant, 
          other_user_id: otherParticipant,
          conversation_type: 'direct'
        },
        {
          $set: {
            state: 'visible',
            last_message_at: now,
            updated_at: now
          },
          $setOnInsert: {
            conversation_id: `${participant}_${otherParticipant}_direct`,
            created_at: now
          }
        },
        { upsert: true }
      );
    }
    
    return NextResponse.json({ success: true, message: { ...message, content } }); // Return decrypted content
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}

// PATCH: Mark messages as read
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
    const { sender_id } = body;
    if (!sender_id) return NextResponse.json({ success: false, message: 'Missing sender_id' }, { status: 400 });
    
    // Get the private conversation for these users
    const sortedParticipants = getSortedParticipants(user.user_id, sender_id);
    const privateConversation = await db.collection('private_conversations').findOne({
      participant_ids: sortedParticipants
    });
    
    if (!privateConversation) {
      return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });
    }
    
    // Mark all messages from sender_id to this user as read within this conversation
    await db.collection('pm').updateMany(
      { 
        conversation_id: privateConversation._id,
        sender_id, 
        receiver_id: user.user_id, 
        read: false 
      },
      { $set: { read: true } }
    );
    
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}

// DELETE: Hide conversation for the logged-in user (don't actually delete messages)
export async function DELETE(request: Request) {
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
    if (!other_user_id) return NextResponse.json({ success: false, message: 'Missing other_user_id' }, { status: 400 });
    
    // Debug logging
    console.log('DELETE request - Current user:', user.user_id, 'Other user:', other_user_id);
    
    // Instead of deleting messages, hide the conversation for this user
    await db.collection('conversation_states').updateOne(
      { 
        user_id: user.user_id, 
        other_user_id,
        conversation_type: 'direct'
      },
      {
        $set: {
          state: 'hidden',
          updated_at: new Date()
        },
        $setOnInsert: {
          conversation_id: `${user.user_id}_${other_user_id}_direct`,
          created_at: new Date(),
          last_message_at: new Date()
        }
      },
      { upsert: true }
    );
    
    console.log('Conversation hidden for user:', user.user_id);
    
    return NextResponse.json({ success: true, action: 'hidden' });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}
