import { NextRequest, NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import { getAuthenticatedUser, connectToDatabase, getGroupMessages } from '../../../../../lib/mongodb-connection';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

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

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const cookieStore = req.cookies;
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fast authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const params = await context.params;
    const groupId = params.id;

    // Check if user is a member of the group (optimized query)
    const membership = await db.collection('group_members').findOne({
      group_id: groupId,
      user_id: auth.userId
    }, { projection: { _id: 1 } });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    // Get query parameters
    const url = new URL(req.url);
    const channelId = url.searchParams.get('channel_id');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Get messages using optimized function
    const messages = await getGroupMessages(groupId, channelId || undefined, limit);

    // Decrypt messages
    const decryptedMessages = (messages as MessageDocument[]).map((msg: MessageDocument) => {
      try {
        const decryptedBytes = CryptoJS.AES.decrypt(msg.content, SECRET_KEY);
        const content = decryptedBytes.toString(CryptoJS.enc.Utf8);
        return {
          ...msg,
          content: content || '[Decryption failed]'
        };
      } catch {
        return {
          ...msg,
          content: '[Decryption failed]'
        };
      }
    });

    return NextResponse.json({ 
      success: true, 
      messages: decryptedMessages.reverse() // Show oldest first
    });
  } catch (error) {
    console.error('Group messages GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const cookieStore = req.cookies;
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fast authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const params = await context.params;
    const groupId = params.id;

    // Check if user is a member of the group
    const membership = await db.collection('group_members').findOne({
      group_id: groupId,
      user_id: auth.userId
    }, { projection: { _id: 1 } });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    const body = await req.json();
    const { content, channel_id } = body;

    if (!content || !channel_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify channel exists and belongs to group
    const channel = await db.collection('group_channels').findOne({
      channel_id,
      group_id: groupId
    }, { projection: { _id: 1 } });

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    // Encrypt message content
    const encryptedContent = CryptoJS.AES.encrypt(content, SECRET_KEY).toString();
    
    const message = {
      message_id: uuidv4(),
      group_id: groupId,
      channel_id,
      sender_id: auth.userId,
      content: encryptedContent,
      timestamp: new Date().toISOString(),
      edited: false,
      attachments: []
    };

    await db.collection('group_messages').insertOne(message);

    return NextResponse.json({ 
      success: true, 
      message: { ...message, content, encrypted_content: undefined }
    });
  } catch (error) {
    console.error('Group messages POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const cookieStore = req.cookies;
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fast authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const params = await context.params;
    const groupId = params.id;

    const body = await req.json();
    const { message_id } = body;

    if (!message_id) {
      return NextResponse.json({ error: 'Missing message_id' }, { status: 400 });
    }

    // Verify user can delete this message (either sender or admin)
    const message = await db.collection('group_messages').findOne({
      message_id,
      group_id: groupId
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Check if user is sender or group admin
    const canDelete = message.sender_id === auth.userId;
    
    if (!canDelete) {
      // Check if user is group admin
      const group = await db.collection('groups').findOne({
        group_id: groupId,
        creator_id: auth.userId
      }, { projection: { _id: 1 } });
      
      if (!group) {
        return NextResponse.json({ error: 'Not authorized to delete this message' }, { status: 403 });
      }
    }

    const result = await db.collection('group_messages').deleteOne({
      message_id,
      group_id: groupId
    });

    return NextResponse.json({ 
      success: true, 
      deleted: result.deletedCount > 0
    });
  } catch (error) {
    console.error('Group messages DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
