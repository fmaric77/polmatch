import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { getAuthenticatedUser, connectToDatabase } from '../../../../../../../lib/mongodb-connection';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

interface RouteContext {
  params: Promise<{ id: string; channelId: string }>;
}

// Essential indexing functions inlined to avoid import issues
async function ensureIndexes(db: any, collectionName: string): Promise<void> {
  const coll = db.collection(collectionName);
  try {
    if (collectionName === 'group_messages') {
      await coll.createIndex({ group_id: 1, channel_id: 1, timestamp: 1 }, { background: true });
      await coll.createIndex({ message_id: 1 }, { unique: true, background: true });
      await coll.createIndex({ sender_id: 1, timestamp: -1 }, { background: true });
    } else if (collectionName === 'group_message_reads') {
      await coll.createIndex({ message_id: 1, user_id: 1 }, { unique: true, background: true });
      await coll.createIndex({ user_id: 1, read_at: -1 }, { background: true });
    }
  } catch (error) {
    // Index might already exist, which is fine
  }
}

// GET: Fetch messages for a specific channel (OPTIMIZED)
export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    // Use cached authentication instead of creating new connection
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // OPTIMIZATION 1: Use cached authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // OPTIMIZATION 2: Use pooled connection
    const { db } = await connectToDatabase();

    const params = await context.params;
    const groupId = params.id;
    const channelId = params.channelId;

    // OPTIMIZATION 3: Combine membership and channel checks in parallel
    const [membership, channel] = await Promise.all([
      db.collection('group_members').findOne({
        group_id: groupId,
        user_id: auth.userId
      }),
      db.collection('group_channels').findOne({
        channel_id: channelId,
        group_id: groupId
      })
    ]);

    if (!membership) {
      return NextResponse.json({ 
        error: 'Not a member of this group' 
      }, { status: 403 });
    }

    if (!channel) {
      return NextResponse.json({ 
        error: 'Channel not found' 
      }, { status: 404 });
    }

    // OPTIMIZATION 4: Simplified aggregation pipeline (removed complex read status lookup)
    const messages = await db.collection('group_messages').aggregate([
      { $match: { group_id: groupId, channel_id: channelId } },
      { $sort: { timestamp: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'users',
          localField: 'sender_id',
          foreignField: 'user_id',
          as: 'sender',
          pipeline: [{ $project: { user_id: 1, username: 1 } }] // Only get needed fields
        }
      },
      { $unwind: '$sender' },
      {
        $project: {
          message_id: 1,
          group_id: 1,
          channel_id: 1,
          sender_id: 1,
          content: 1,
          timestamp: 1,
          attachments: 1,
          sender_username: '$sender.username'
        }
      },
      { $sort: { timestamp: 1 } } // Final sort ascending for display
    ]).toArray();

    // Decrypt message content
    const decryptedMessages = messages.map((message: any) => {
      try {
        const decryptedContent = CryptoJS.AES.decrypt(message.content, SECRET_KEY).toString(CryptoJS.enc.Utf8);
        return { ...message, content: decryptedContent };
      } catch (error) {
        console.error('Failed to decrypt message:', error);
        return { ...message, content: '[Decryption failed]' };
      }
    });

    return NextResponse.json({ 
      success: true, 
      messages: decryptedMessages 
    });

  } catch (error) {
    console.error('Error fetching channel messages:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST: Send a message to a specific channel (OPTIMIZED)
export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    // Use cached authentication instead of creating new connection
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // OPTIMIZATION 1: Use cached authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // OPTIMIZATION 2: Use pooled connection
    const { db } = await connectToDatabase();

    const params = await context.params;
    const groupId = params.id;
    const channelId = params.channelId;
    const { content, attachments } = await req.json();

    if (!content || content.trim() === '') {
      return NextResponse.json({ 
        error: 'Message content is required' 
      }, { status: 400 });
    }

    // OPTIMIZATION 3: Combine membership and channel checks in parallel
    const [membership, channel] = await Promise.all([
      db.collection('group_members').findOne({
        group_id: groupId,
        user_id: auth.userId
      }),
      db.collection('group_channels').findOne({
        channel_id: channelId,
        group_id: groupId
      })
    ]);

    if (!membership) {
      return NextResponse.json({ 
        error: 'Not a member of this group' 
      }, { status: 403 });
    }

    if (!channel) {
      return NextResponse.json({ 
        error: 'Channel not found' 
      }, { status: 404 });
    }

    // Encrypt the message content
    const encryptedContent = CryptoJS.AES.encrypt(content, SECRET_KEY).toString();

    // Create message
    const messageId = uuidv4();
    const message = {
      message_id: messageId,
      group_id: groupId,
      channel_id: channelId,
      sender_id: auth.userId,
      content: encryptedContent,
      timestamp: new Date(),
      attachments: attachments || []
    };

    // Ensure indexes exist before inserting
    await ensureIndexes(db, 'group_messages');

    // OPTIMIZATION 4: Parallel operations for message insertion and group update
    await Promise.all([
      db.collection('group_messages').insertOne(message),
      db.collection('groups').updateOne(
        { group_id: groupId },
        { $set: { last_activity: new Date() } }
      )
    ]);

    return NextResponse.json({ 
      success: true, 
      message_id: messageId,
      message: 'Message sent successfully' 
    });

  } catch (error) {
    console.error('Error sending channel message:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
