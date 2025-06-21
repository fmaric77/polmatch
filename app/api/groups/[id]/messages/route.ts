import { NextRequest, NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import { getAuthenticatedUser, connectToDatabase } from '../../../../../lib/mongodb-connection';

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

    // Get query parameters including profile_type
    const url = new URL(req.url);
    const channelId = url.searchParams.get('channel_id');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const profile_type = url.searchParams.get('profile_type') || 'basic';

    // Validate profile_type
    if (!['basic', 'love', 'business'].includes(profile_type)) {
      return NextResponse.json({ 
        error: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    // Use profile-specific collections
    const membersCollection = profile_type === 'basic' ? 'group_members' : `group_members_${profile_type}`;
    const messagesCollection = profile_type === 'basic' ? 'group_messages' : `group_messages_${profile_type}`;

    // Check if user is a member of the group (optimized query)
    const membership = await db.collection(membersCollection).findOne({
      group_id: groupId,
      user_id: auth.userId
    }, { projection: { _id: 1 } });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    // Build query for messages
    const messageQuery: Record<string, unknown> = { group_id: groupId };
    if (channelId) {
      messageQuery.channel_id = channelId;
    }

    // Get messages from profile-specific collection
    const messagesRaw = await db.collection(messagesCollection)
      .find(messageQuery)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    const messages = messagesRaw as MessageDocument[];

    // Get unique sender IDs to fetch user information
    const senderIds = [...new Set(messages.map((msg: MessageDocument) => msg.sender_id))];
    
    // Fetch usernames from users collection
    const users = await db.collection('users')
      .find({ user_id: { $in: senderIds } })
      .project({ user_id: 1, username: 1 })
      .toArray();
    
    // Fetch profile-specific display names
    const profileCollectionName = `${profile_type}profiles`;
    const profiles = await db.collection(profileCollectionName)
      .find({ user_id: { $in: senderIds } })
      .project({ user_id: 1, display_name: 1 })
      .toArray();

    // Create lookup maps
    const userMap = new Map(users.map(u => [u.user_id, u.username]));
    const profileMap = new Map(profiles.map(p => [p.user_id, p.display_name]));

    // Decrypt messages and enrich with user information
    const decryptedMessages = messages.map((msg: MessageDocument) => {
      try {
        const decryptedBytes = CryptoJS.AES.decrypt(msg.content, SECRET_KEY);
        const content = decryptedBytes.toString(CryptoJS.enc.Utf8);
        const username = userMap.get(msg.sender_id) || 'Unknown';
        const profileDisplayName = profileMap.get(msg.sender_id);
        
        return {
          ...msg,
          content: content || '[Decryption failed]',
          sender_username: username,
          // Always use profile display name, never username
          sender_display_name: profileDisplayName && profileDisplayName.trim() ? profileDisplayName : '[NO PROFILE NAME]'
        };
      } catch {
        const username = userMap.get(msg.sender_id) || 'Unknown';
        const profileDisplayName = profileMap.get(msg.sender_id);
        return {
          ...msg,
          content: '[Decryption failed]',
          sender_username: username,
          // Always use profile display name, never username
          sender_display_name: profileDisplayName && profileDisplayName.trim() ? profileDisplayName : '[NO PROFILE NAME]'
        };
      }
    });

    return NextResponse.json({ 
      success: true, 
      messages: decryptedMessages.reverse(), // Show oldest first
      profile_type
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

    const body = await req.json();
    const { content, channel_id, reply_to, profile_type = 'basic' } = body;

    if (!content || !channel_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate profile_type
    if (!['basic', 'love', 'business'].includes(profile_type)) {
      return NextResponse.json({ 
        error: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    // Use profile-specific collections
    const membersCollection = profile_type === 'basic' ? 'group_members' : `group_members_${profile_type}`;
    const messagesCollection = profile_type === 'basic' ? 'group_messages' : `group_messages_${profile_type}`;
    const channelsCollection = profile_type === 'basic' ? 'group_channels' : `group_channels_${profile_type}`;

    // Check if user is a member of the group
    const membership = await db.collection(membersCollection).findOne({
      group_id: groupId,
      user_id: auth.userId
    }, { projection: { _id: 1 } });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    // Validate reply_to if provided
    if (reply_to !== undefined) {
      if (typeof reply_to !== 'object' || reply_to === null) {
        return NextResponse.json({ 
          error: 'reply_to must be an object' 
        }, { status: 400 });
      }
      
      const requiredReplyFields = ['message_id', 'content', 'sender_name'];
      for (const field of requiredReplyFields) {
        if (!reply_to[field] || typeof reply_to[field] !== 'string') {
          return NextResponse.json({ 
            error: `reply_to.${field} is required and must be a string` 
          }, { status: 400 });
        }
      }
      
      // Validate reply content length
      if (reply_to.content.length > 500) {
        return NextResponse.json({ 
          error: 'reply_to.content too long (max 500 characters)' 
        }, { status: 400 });
      }
    }

    // Verify channel exists and belongs to group
    const channel = await db.collection(channelsCollection).findOne({
      channel_id,
      group_id: groupId
    }, { projection: { _id: 1 } });

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    // Encrypt message content
    const encryptedContent = CryptoJS.AES.encrypt(content, SECRET_KEY).toString();
    
    const message: Record<string, unknown> = {
      message_id: uuidv4(),
      group_id: groupId,
      channel_id,
      sender_id: auth.userId,
      content: encryptedContent,
      timestamp: new Date().toISOString(),
      edited: false,
      attachments: [],
      profile_type
    };

    // Add reply_to information if provided
    if (reply_to) {
      message.reply_to = {
        message_id: reply_to.message_id,
        content: reply_to.content,
        sender_name: reply_to.sender_name
      };
    }

    await db.collection(messagesCollection).insertOne(message);

    return NextResponse.json({ 
      success: true, 
      message: { ...message, content, encrypted_content: undefined },
      profile_type
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
    const { message_id, profile_type = 'basic' } = body;

    if (!message_id) {
      return NextResponse.json({ error: 'Missing message_id' }, { status: 400 });
    }

    // Validate profile_type
    if (!['basic', 'love', 'business'].includes(profile_type)) {
      return NextResponse.json({ 
        error: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    // Use profile-specific collections
    const membersCollection = profile_type === 'basic' ? 'group_members' : `group_members_${profile_type}`;
    const messagesCollection = profile_type === 'basic' ? 'group_messages' : `group_messages_${profile_type}`;

    // Verify user can delete this message (either sender or admin)
    const message = await db.collection(messagesCollection).findOne({
      message_id,
      group_id: groupId
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Check if user is sender or group admin/owner
    let canDelete = message.sender_id === auth.userId;
    
    if (!canDelete) {
      // Check if user is group admin or owner
      const membership = await db.collection(membersCollection).findOne({
        group_id: groupId,
        user_id: auth.userId
      });
      
      if (membership && (membership.role === 'owner' || membership.role === 'admin')) {
        canDelete = true;
      }
    }
    
    if (!canDelete) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not authorized to delete this message' 
      }, { status: 403 });
    }

    // Delete the message from profile-specific collection
    const result = await db.collection(messagesCollection).deleteOne({
      message_id,
      group_id: groupId
    });

    return NextResponse.json({ 
      success: true, 
      deleted: result.deletedCount > 0,
      deletedMessages: result.deletedCount,
      profile_type
    });
  } catch (error) {
    console.error('Group messages DELETE error:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
