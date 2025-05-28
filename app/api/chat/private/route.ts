import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import CryptoJS from 'crypto-js';
import { getAuthenticatedUser, connectToDatabase } from '../../../../lib/mongodb-connection';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

// Helper function to get sorted participant IDs
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// POST: Send a private message
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const { receiver_id, content } = await req.json();

    if (!receiver_id || !content) {
      return NextResponse.json({ 
        error: 'Receiver ID and content are required' 
      }, { status: 400 });
    }

    // Check if the receiver exists
    const receiver = await db.collection('users').findOne({ user_id: receiver_id });
    if (!receiver) {
      return NextResponse.json({ 
        error: 'Receiver not found' 
      }, { status: 404 });
    }

    // Prevent sending messages to yourself
    if (auth.user.user_id === receiver_id) {
      return NextResponse.json({ 
        error: 'Cannot send message to yourself' 
      }, { status: 400 });
    }

    const now = new Date();

    // Encrypt the message content
    const encryptedContent = CryptoJS.AES.encrypt(content, SECRET_KEY).toString();

    // Create the message document
    const messageDoc = {
      sender_id: auth.user.user_id,
      receiver_id: receiver_id,
      encrypted_content: encryptedContent,
      timestamp: now,
      read: false,
      attachments: []
    };

    // Insert the message
    const messageResult = await db.collection('private_messages').insertOne(messageDoc);

    // Create or update the private conversation
    const sortedParticipants = getSortedParticipants(auth.user.user_id, receiver_id);
    
    await db.collection('private_conversations').updateOne(
      { participant_ids: sortedParticipants },
      {
        $set: { updated_at: now },
        $setOnInsert: {
          participant_ids: sortedParticipants,
          created_at: now
        }
      },
      { upsert: true }
    );

    // Update conversation states for both users
    const conversationId = `${auth.user.user_id}_${receiver_id}_direct`;
    
    // Update sender's conversation state
    await db.collection('conversation_states').updateOne(
      { 
        user_id: auth.user.user_id, 
        other_user_id: receiver_id,
        conversation_type: 'direct' 
      },
      {
        $set: {
          conversation_id: conversationId,
          state: 'visible',
          last_message_at: now,
          updated_at: now
        },
        $setOnInsert: {
          created_at: now
        }
      },
      { upsert: true }
    );

    // Update receiver's conversation state
    await db.collection('conversation_states').updateOne(
      { 
        user_id: receiver_id, 
        other_user_id: auth.user.user_id,
        conversation_type: 'direct' 
      },
      {
        $set: {
          conversation_id: conversationId,
          state: 'visible',
          last_message_at: now,
          updated_at: now
        },
        $setOnInsert: {
          created_at: now
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ 
      success: true,
      message_id: messageResult.insertedId,
      message: 'Message sent successfully'
    });

  } catch (error) {
    console.error('Error sending private message:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
