import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import CryptoJS from 'crypto-js';
import MONGODB_URI from '../../mongo-uri';

const SECRET_KEY = process.env.SECRET_KEY as string;
if (!SECRET_KEY) {
  throw new Error('SECRET_KEY environment variable is not defined');
}

// Helper function to get sorted participant IDs for consistent conversation identification
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// POST: Create a conversation and optionally send an initial message
export async function POST(request: NextRequest): Promise<NextResponse> {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    await client.connect();
    const db = client.db('polmatch');
    
    // Verify session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      receiver_id, 
      sender_profile_type = 'basic', 
      receiver_profile_type = 'basic',
      initial_message 
    } = body;

    if (!receiver_id) {
      return NextResponse.json({ 
        success: false, 
        message: 'receiver_id is required' 
      }, { status: 400 });
    }

    // Verify receiver exists
    const receiver = await db.collection('users').findOne({ user_id: receiver_id });
    if (!receiver) {
      return NextResponse.json({ 
        success: false, 
        message: 'Receiver not found' 
      }, { status: 404 });
    }

    const now = new Date();
    const sortedParticipants = getSortedParticipants(user.user_id, receiver_id);
    
    // Determine conversation collection based on profile types
    let conversationCollectionName = 'private_conversations';
    let profileContext = '';
    
    if (sender_profile_type !== 'basic' || receiver_profile_type !== 'basic') {
      // Use profile-specific collection if either profile is not basic
      const profileType = sender_profile_type === 'basic' ? receiver_profile_type : sender_profile_type;
      conversationCollectionName = `private_conversations_${profileType}`;
      profileContext = `${sender_profile_type}_${receiver_profile_type}`;
    }

    // Check if conversation already exists
    let conversation = await db.collection(conversationCollectionName).findOne({
      participant_ids: sortedParticipants,
      ...(profileContext && { profile_context: profileContext })
    });

    if (!conversation) {
      // Create new conversation
      const newConversation = {
        participant_ids: sortedParticipants,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        ...(profileContext && { profile_context: profileContext })
      };
      
      const insertResult = await db.collection(conversationCollectionName).insertOne(newConversation);
      conversation = { _id: insertResult.insertedId, ...newConversation };
    }

    // Send initial message if provided
    if (initial_message && initial_message.trim()) {
      // Encrypt the message content
      const encryptedContent = CryptoJS.AES.encrypt(initial_message.trim(), SECRET_KEY).toString();
      
      const message = {
        conversation_id: conversation._id,
        sender_id: user.user_id,
        receiver_id,
        content: encryptedContent,
        timestamp: now.toISOString(),
        read: false,
        attachments: [],
        ...(profileContext && { profile_type: sender_profile_type })
      };

      await db.collection('pm').insertOne(message);

      // Update conversation timestamp
      await db.collection(conversationCollectionName).updateOne(
        { _id: conversation._id },
        { $set: { updated_at: now.toISOString() } }
      );
    }

    // Create/update conversation states for both participants
    const conversationId = `${user.user_id}_${receiver_id}_direct`;

    // Update sender's conversation state
    await db.collection('conversation_states').updateOne(
      { 
        user_id: user.user_id, 
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
        other_user_id: user.user_id,
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
      conversation_id: conversation._id,
      message: initial_message ? 'Conversation created and message sent' : 'Conversation created'
    });

  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to create conversation' 
    }, { status: 500 });
  } finally {
    await client.close();
  }
}