import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import CryptoJS from 'crypto-js';
import { ObjectId } from 'mongodb';
import { getAuthenticatedUser, connectToDatabase, getPrivateMessages } from '../../../lib/mongodb-connection';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

interface PrivateMessage {
  _id?: unknown;
  sender_id: string;
  receiver_id?: string;
  encrypted_content?: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachments: string[];
  [key: string]: unknown;
}

// Helper function to get sorted participant IDs for consistent conversation lookup
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// GET: Fetch messages for a specific conversation or all conversations for the user
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    // Fast authentication with caching
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    const url = new URL(request.url);
    const otherUserId = url.searchParams.get('user_id');
    
    let pms;
    
    if (otherUserId) {
      // Get messages for specific conversation using optimized function
      pms = await getPrivateMessages(auth.userId, otherUserId, 50);
      
      // Decrypt messages
      for (const pm of pms as PrivateMessage[]) {
        try {
          const decryptedBytes = CryptoJS.AES.decrypt(pm.encrypted_content || pm.content, SECRET_KEY);
          pm.content = decryptedBytes.toString(CryptoJS.enc.Utf8);
          delete pm.encrypted_content;
        } catch {
          pm.content = '[Decryption failed]';
          delete pm.encrypted_content;
        }
      }
      
      // Reverse to show oldest first
      pms.reverse();
    } else {
      // Get all conversations for the user using optimized aggregation
      const conversations = await db.collection('private_conversations').aggregate([
        { $match: { participant_ids: auth.userId } },
        { $sort: { updated_at: -1 } },
        { $limit: 20 },
        {
          $lookup: {
            from: 'pm',
            let: { participantIds: '$participant_ids' },
            pipeline: [
              { 
                $match: { 
                  $expr: { 
                    $and: [
                      { $isArray: '$participant_ids' },
                      { $isArray: '$$participantIds' },
                      { $setEquals: ['$participant_ids', '$$participantIds'] }
                    ]
                  }
                }
              },
              { $sort: { timestamp: -1 } },
              { $limit: 1 }
            ],
            as: 'lastMessage'
          }
        },
        { $unwind: { path: '$lastMessage', preserveNullAndEmptyArrays: true } }
      ]).toArray();
      
      // Decrypt last messages
      for (const conv of conversations) {
        if (conv.lastMessage) {
          try {
            const decryptedBytes = CryptoJS.AES.decrypt(conv.lastMessage.encrypted_content, SECRET_KEY);
            conv.lastMessage.content = decryptedBytes.toString(CryptoJS.enc.Utf8);
            delete conv.lastMessage.encrypted_content;
          } catch {
            conv.lastMessage.content = '[Decryption failed]';
            delete conv.lastMessage.encrypted_content;
          }
        }
      }
      
      return NextResponse.json({ success: true, conversations });
    }
    
    return NextResponse.json({ success: true, messages: pms });
  } catch (err) {
    console.error('Messages API error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) }, { status: 500 });
  }
}

// POST: Send a new message
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    // Fast authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    const body = await request.json();
    const { receiver_id, content, attachments } = body;
    if (!receiver_id || !content) {
      return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
    }
    
    // Verify receiver exists (with projection to only get user_id)
    const receiver = await db.collection('users').findOne(
      { user_id: receiver_id },
      { projection: { user_id: 1 } }
    );
    if (!receiver) {
      return NextResponse.json({ success: false, message: 'Receiver not found' }, { status: 404 });
    }
    
    const now = new Date();
    const sortedParticipants = getSortedParticipants(auth.userId, receiver_id);
    
    // Find or create private conversation using upsert
    await db.collection('private_conversations').findOneAndUpdate(
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
    
    // Encrypt the message content before saving
    const encryptedContent = CryptoJS.AES.encrypt(content, SECRET_KEY).toString();
    const message = {
      participant_ids: sortedParticipants,
      sender_id: auth.userId,
      receiver_id,
      encrypted_content: encryptedContent,
      timestamp: now.toISOString(),
      is_read: false,
      attachments: attachments || [],
    };
    
    await db.collection('pm').insertOne(message);
    
    return NextResponse.json({ success: true, message: { ...message, content, encrypted_content: undefined } });
  } catch (err) {
    console.error('Messages POST error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) }, { status: 500 });
  }
}

// PATCH: Mark messages as read
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    // Fast authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    const body = await request.json();
    const { sender_id } = body;
    if (!sender_id) {
      return NextResponse.json({ success: false, message: 'Missing sender_id' }, { status: 400 });
    }
    
    // Mark messages as read using optimized query
    const sortedParticipants = getSortedParticipants(auth.userId, sender_id);
    const result = await db.collection('pm').updateMany(
      { 
        participant_ids: sortedParticipants,
        sender_id, 
        is_read: false 
      },
      { $set: { is_read: true } }
    );
    
    return NextResponse.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('Messages PATCH error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) }, { status: 500 });
  }
}

// DELETE: Delete conversation or individual message
export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    // Fast authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    const body = await request.json();
    const { other_user_id, message_id } = body;
    
    // If message_id is provided, delete individual message
    if (message_id) {
      // Convert string to ObjectId if needed
      let objectId;
      try {
        objectId = typeof message_id === 'string' ? new ObjectId(message_id) : message_id;
      } catch {
        return NextResponse.json({ success: false, message: 'Invalid message_id format' }, { status: 400 });
      }
      
      // Find the message to verify ownership and get conversation details
      const message = await db.collection('pm').findOne({ _id: objectId });
      
      if (!message) {
        return NextResponse.json({ success: false, message: 'Message not found' }, { status: 404 });
      }
      
      // Check if user is the sender of the message
      if (message.sender_id !== auth.userId) {
        return NextResponse.json({ success: false, message: 'Not authorized to delete this message' }, { status: 403 });
      }
      
      // Delete the individual message
      const deleteResult = await db.collection('pm').deleteOne({ _id: objectId });
      
      return NextResponse.json({ 
        success: true, 
        deletedMessages: deleteResult.deletedCount,
        type: 'message'
      });
    }
    
    // If other_user_id is provided, delete entire conversation
    if (!other_user_id) {
      return NextResponse.json({ success: false, message: 'Missing other_user_id or message_id' }, { status: 400 });
    }
    
    const sortedParticipants = getSortedParticipants(auth.userId, other_user_id);
    
    // Delete messages and conversation in parallel
    const [deleteMessagesResult, deleteConversationResult] = await Promise.all([
      db.collection('pm').deleteMany({ participant_ids: sortedParticipants }),
      db.collection('private_conversations').deleteOne({ participant_ids: sortedParticipants })
    ]);
    
    return NextResponse.json({ 
      success: true, 
      deletedMessages: deleteMessagesResult.deletedCount,
      deletedConversation: deleteConversationResult.deletedCount,
      type: 'conversation'
    });
  } catch (err) {
    console.error('Messages DELETE error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) }, { status: 500 });
  }
}
