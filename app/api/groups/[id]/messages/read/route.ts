import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../../mongo-uri';
import { cookies } from 'next/headers';


if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH: Mark group messages as read for the current user
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('polmatch');

    // Verify session
    const session = await db.collection('sessions').findOne({ 
      sessionToken: sessionToken 
    });
    
    if (!session) {
      await client.close();
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const params = await context.params;
    const groupId = params.id;

    // Get profile_type from request body
    const body = await req.json();
    const { profile_type = 'basic' } = body;

    // Validate profile_type
    if (!['basic', 'love', 'business'].includes(profile_type)) {
      await client.close();
      return NextResponse.json({ 
        error: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    // Use profile-specific collections
    const membersCollection = profile_type === 'basic' ? 'group_members' : `group_members_${profile_type}`;
    const messagesCollection = profile_type === 'basic' ? 'group_messages' : `group_messages_${profile_type}`;
    const readsCollection = profile_type === 'basic' ? 'group_message_reads' : `group_message_reads_${profile_type}`;

    // Check if user is a member of the group
    const membership = await db.collection(membersCollection).findOne({
      group_id: groupId,
      user_id: session.user_id
    });

    if (!membership) {
      await client.close();
      return NextResponse.json({ 
        error: 'Not a member of this group' 
      }, { status: 403 });
    }

    // Get all group messages that haven't been read by this user
    const messages = await db.collection(messagesCollection).find({
      group_id: groupId
    }).toArray();

    const readRecords = [];
    for (const message of messages) {
      // Check if user has already read this message
      const existingRead = await db.collection(readsCollection).findOne({
        message_id: message.message_id,
        user_id: session.user_id
      });

      if (!existingRead) {
        readRecords.push({
          message_id: message.message_id,
          group_id: groupId,
          user_id: session.user_id,
          read_at: new Date()
        });
      }
    }

    // Insert read records
    if (readRecords.length > 0) {
      await db.collection(readsCollection).insertMany(readRecords);
    }

    await client.close();

    return NextResponse.json({ 
      success: true, 
      marked_count: readRecords.length,
      profile_type
    });

  } catch (error) {
    console.error('Error marking group messages as read:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
