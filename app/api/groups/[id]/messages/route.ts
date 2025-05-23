import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../mongo-uri';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
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

    // Get group messages
    const messages = await db.collection('group_messages').aggregate([
      { $match: { group_id: groupId } },
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
        $project: {
          message_id: 1,
          group_id: 1,
          sender_id: 1,
          content: 1,
          timestamp: 1,
          attachments: 1,
          sender_username: '$sender.username'
        }
      },
      { $sort: { timestamp: 1 } }
    ]).toArray();

    // Decrypt message content
    const decryptedMessages = messages.map(msg => ({
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

    await client.close();

    return NextResponse.json({ 
      success: true, 
      messages: decryptedMessages 
    });

  } catch (error) {
    console.error('Error fetching group messages:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
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
    const { content, attachments } = await req.json();

    if (!content) {
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

    // Encrypt the message content
    const encryptedContent = CryptoJS.AES.encrypt(content, SECRET_KEY).toString();

    // Create message
    const message = {
      message_id: uuidv4(),
      group_id: groupId,
      sender_id: session.user_id,
      content: encryptedContent,
      timestamp: new Date(),
      attachments: attachments || []
    };

    await db.collection('group_messages').insertOne(message);

    // Update group last activity
    await db.collection('groups').updateOne(
      { group_id: groupId },
      { $set: { last_activity: new Date() } }
    );

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message_id: message.message_id,
      message: 'Message sent successfully' 
    });

  } catch (error) {
    console.error('Error sending group message:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
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
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      await client.close();
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }
    // Get group ID
    const params = await context.params;
    const groupId = params.id;
    // Check membership
    const membership = await db.collection('group_members').findOne({ group_id: groupId, user_id: session.user_id });
    if (!membership) {
      await client.close();
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }
    // Parse message_id
    const { message_id } = await req.json();
    if (!message_id) {
      await client.close();
      return NextResponse.json({ error: 'Message ID required' }, { status: 400 });
    }
    // Delete only if sender matches
    const result = await db.collection('group_messages').deleteOne({ message_id, group_id: groupId, sender_id: session.user_id });
    await client.close();
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Message not found or not authorized' }, { status: 404 });
    }
    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Error deleting group message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
