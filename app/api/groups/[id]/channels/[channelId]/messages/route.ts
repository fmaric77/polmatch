import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import * as CryptoJS from 'crypto-js';
import { ObjectId } from 'mongodb';
import { getAuthenticatedUser, connectToDatabase } from '../../../../../../../lib/mongodb-connection';
import { notifyNewGroupMessage } from '../../../../../../../lib/sse-notifications';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

interface RouteContext {
  params: Promise<{ id: string; channelId: string }>;
}

interface MessageDocument {
  _id?: unknown;
  message_id: string;
  content: string;
  sender_id: string;
  sender_username?: string;
  timestamp: Date;
  group_id: string;
  channel_id: string;
  attachments?: number;
  [key: string]: unknown;
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
    
    // OPTIMIZATION: Support count_only and last_check parameters
    const url = new URL(req.url);
    const lastCheck = url.searchParams.get('last_check');
    const countOnly = url.searchParams.get('count_only') === 'true';

    // OPTIMIZATION 3: Combine membership and channel checks in parallel
    const [membership, channel] = await Promise.all([
      db.collection('group_members').findOne({
        group_id: groupId,
        user_id: auth.userId
      }, { projection: { _id: 1 } }),
      db.collection('group_channels').findOne({
        channel_id: channelId,
        group_id: groupId
      }, { projection: { _id: 1 } })
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

    // OPTIMIZATION: If count_only is true, just check if there are new messages
    if (countOnly && lastCheck) {
      const query: Record<string, unknown> = { group_id: groupId, channel_id: channelId };
      
      if (lastCheck) {
        query.timestamp = { $gt: new Date(lastCheck) };
      }
      
      const newMessageCount = await db.collection('group_messages').countDocuments(query);
      
      return NextResponse.json({ 
        success: true, 
        has_new_messages: newMessageCount > 0,
        new_message_count: newMessageCount
      });
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
          // Handle both field names - some messages use 'content', others use 'encrypted_content'
          content: { 
            $cond: { 
              if: { $ifNull: ['$content', false] }, 
              then: '$content', 
              else: '$encrypted_content' 
            } 
          },
          timestamp: 1,
          attachments: 1,
          sender_username: '$sender.username'
        }
      },
      { $sort: { timestamp: 1 } } // Final sort ascending for display
    ]).toArray();

    // Decrypt message content
    const decryptedMessages = (messages as MessageDocument[]).map((message: MessageDocument) => {
      try {
        if (!message.content) {
          return { ...message, content: '[No content field]' };
        }
        
        const decryptedContent = CryptoJS.AES.decrypt(message.content, SECRET_KEY).toString(CryptoJS.enc.Utf8);
        return { ...message, content: decryptedContent };
      } catch {
        console.error('Failed to decrypt message for ID:', message.message_id);
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
      }, { projection: { _id: 1 } }),
      db.collection('group_channels').findOne({
        channel_id: channelId,
        group_id: groupId
      }, { projection: { _id: 1 } })
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
      timestamp: new Date().toISOString(),
      edited: false,
      attachments: attachments || []
    };

    await db.collection('group_messages').insertOne(message);

    // Send SSE notification to all group members
    await notifyNewGroupMessage({
      message_id: messageId,
      group_id: groupId,
      channel_id: channelId,
      sender_id: auth.userId,
      content: content, // Use unencrypted content for notification
      timestamp: message.timestamp,
      attachments: attachments || [],
      sender_username: auth.user.username // Use username from auth if available
    });

    return NextResponse.json({ 
      success: true, 
      message: { ...message, content, encrypted_content: undefined }
    });

  } catch (error) {
    console.error('Error sending channel message:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// DELETE: Delete a message from a specific channel
export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
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
    const params = await context.params;
    const groupId = params.id;
    const channelId = params.channelId;

    const body = await req.json();
    const { messageId } = body;

    if (!messageId) {
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    }

    // Convert messageId string to ObjectId
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(messageId);
    } catch {
      return NextResponse.json({ error: 'Invalid messageId format' }, { status: 400 });
    }

    // Verify user can delete this message (either sender or group owner/admin)
    const [message, membership] = await Promise.all([
      db.collection('group_messages').findOne({
        _id: objectId,
        group_id: groupId,
        channel_id: channelId
      }),
      db.collection('group_members').findOne({
        group_id: groupId,
        user_id: auth.userId
      })
    ]);

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    // Check if user is sender or has admin privileges
    const canDelete = message.sender_id === auth.userId || 
                     membership.role === 'owner' || 
                     membership.role === 'admin';
    
    if (!canDelete) {
      return NextResponse.json({ 
        error: 'Not authorized to delete this message' 
      }, { status: 403 });
    }

    const result = await db.collection('group_messages').deleteOne({
      _id: objectId,
      group_id: groupId,
      channel_id: channelId
    });

    return NextResponse.json({ 
      success: true, 
      deleted: result.deletedCount > 0
    });

  } catch {
    console.error('Error deleting channel message');
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
