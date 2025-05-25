import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../../../mongo-uri';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

interface RouteContext {
  params: Promise<{ id: string; channelId: string }>;
}

// GET: Fetch messages for a specific channel
export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
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
    const channelId = params.channelId;

    // Check if user is a member of the group
    const membership = await db.collection('group_members').findOne({
      group_id: groupId,
      user_id: session.user_id
    });

    if (!membership) {
      await client.close();
      return NextResponse.json({ 
        error: 'Not a member of this group' 
      }, { status: 403 });
    }

    // Verify channel exists and belongs to the group
    const channel = await db.collection('group_channels').findOne({
      channel_id: channelId,
      group_id: groupId
    });

    if (!channel) {
      await client.close();
      return NextResponse.json({ 
        error: 'Channel not found' 
      }, { status: 404 });
    }

    // Get channel messages with comprehensive read status information
    const messages = await db.collection('group_messages').aggregate([
      { $match: { group_id: groupId, channel_id: channelId } },
      {
        $lookup: {
          from: 'users',
          localField: 'sender_id',
          foreignField: 'user_id',
          as: 'sender'
        }
      },
      { $unwind: '$sender' },
      {
        $lookup: {
          from: 'group_message_reads',
          localField: 'message_id',
          foreignField: 'message_id',
          as: 'all_reads'
        }
      },
      {
        $lookup: {
          from: 'group_members',
          localField: 'group_id',
          foreignField: 'group_id',
          as: 'group_members'
        }
      },
      {
        $project: {
          message_id: 1,
          group_id: 1,
          channel_id: 1,
          sender_id: 1,
          content: 1,
          timestamp: 1,
          attachments: 1,
          sender_username: '$sender.username',
          current_user_read: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$all_reads',
                    cond: { $eq: ['$$this.user_id', session.user_id] }
                  }
                }
              },
              0
            ]
          },
          total_members: { $size: '$group_members' },
          read_count: { $size: '$all_reads' },
          read_by_others: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$all_reads',
                    cond: { $ne: ['$$this.user_id', session.user_id] }
                  }
                }
              },
              0
            ]
          }
        }
      },
      { $sort: { timestamp: 1 } },
      { $limit: 50 } // Limit to last 50 messages
    ]).toArray();

    // Decrypt message content
    const decryptedMessages = messages.map(message => {
      try {
        const decryptedContent = CryptoJS.AES.decrypt(message.content, SECRET_KEY).toString(CryptoJS.enc.Utf8);
        return { ...message, content: decryptedContent };
      } catch (error) {
        console.error('Failed to decrypt message:', error);
        return { ...message, content: '[Unable to decrypt message]' };
      }
    });

    await client.close();

    return NextResponse.json({ 
      success: true, 
      messages: decryptedMessages,
      channel: {
        channel_id: channel.channel_id,
        name: channel.name,
        description: channel.description
      }
    });

  } catch (error) {
    console.error('Error fetching channel messages:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST: Send a message to a specific channel
export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
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
    const channelId = params.channelId;
    const { content, attachments } = await req.json();

    if (!content || content.trim() === '') {
      await client.close();
      return NextResponse.json({ 
        error: 'Message content is required' 
      }, { status: 400 });
    }

    // Check if user is a member of the group
    const membership = await db.collection('group_members').findOne({
      group_id: groupId,
      user_id: session.user_id
    });

    if (!membership) {
      await client.close();
      return NextResponse.json({ 
        error: 'Not a member of this group' 
      }, { status: 403 });
    }

    // Verify channel exists and belongs to the group
    const channel = await db.collection('group_channels').findOne({
      channel_id: channelId,
      group_id: groupId
    });

    if (!channel) {
      await client.close();
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
      sender_id: session.user_id,
      content: encryptedContent,
      timestamp: new Date(),
      attachments: attachments || []
    };

    await db.collection('group_messages').insertOne(message);

    // Mark the message as read by the sender
    await db.collection('group_message_reads').insertOne({
      message_id: messageId,
      user_id: session.user_id,
      read_at: new Date()
    });

    // Update group's last activity
    await db.collection('groups').updateOne(
      { group_id: groupId },
      { $set: { last_activity: new Date() } }
    );

    await client.close();

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
