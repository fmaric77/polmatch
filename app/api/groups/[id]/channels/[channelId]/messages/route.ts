import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import * as CryptoJS from 'crypto-js';
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
  message_type?: 'text' | 'poll';
  poll_data?: {
    poll_id: string;
    question: string;
    options: Array<{ option_id: string; text: string }>;
    expires_at?: string;
  };
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
    const channelsCollection = profile_type === 'basic' ? 'group_channels' : `group_channels_${profile_type}`;

    // OPTIMIZATION 3: Combine membership and channel checks in parallel
    const [membership, channel] = await Promise.all([
      db.collection(membersCollection).findOne({
        group_id: groupId,
        user_id: auth.userId
      }, { projection: { _id: 1 } }),
      db.collection(channelsCollection).findOne({
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
      
      const newMessageCount = await db.collection(messagesCollection).countDocuments(query);
      
      return NextResponse.json({ 
        success: true, 
        has_new_messages: newMessageCount > 0,
        new_message_count: newMessageCount
      });
    }

    // OPTIMIZATION 4: Simplified aggregation pipeline (removed complex read status lookup)
    const messages = await db.collection(messagesCollection).aggregate([
      { $match: { group_id: groupId, channel_id: channelId } },
      { $sort: { timestamp: 1 } }, // Sort oldest first (ascending)
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
          _id: 1, // Include MongoDB ObjectId for deletion
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
          sender_username: '$sender.username',
          reply_to: 1,
          message_type: 1,  // Include message_type for poll detection
          poll_data: 1,     // Include poll_data for poll rendering
          is_pinned: 1,     // Include pinned status
          pinned_at: 1,     // Include pinned timestamp
          pinned_by: 1      // Include who pinned the message
        }
      }
    ]).toArray();

    // Decrypt message content
    const decryptedMessages = (messages as MessageDocument[]).map((message: MessageDocument) => {
      try {
        if (!message.content) {
          return { ...message, content: '[No content field]' };
        }
        
        const decryptedContent = CryptoJS.AES.decrypt(message.content, SECRET_KEY).toString(CryptoJS.enc.Utf8);
        const result = { ...message, content: decryptedContent };
        
        // Log poll messages for debugging
        if (message.message_type === 'poll') {
          console.log('📊 Channel poll message found:', {
            message_id: message.message_id,
            message_type: message.message_type,
            has_poll_data: !!message.poll_data,
            poll_data: message.poll_data
          });
        }
        
        return result;
      } catch {
        console.error('Failed to decrypt message for ID:', message.message_id);
        return { ...message, content: '[Decryption failed]' };
      }
    });

    // Enrich channel messages with profile-specific display names
    const channelSenderIds = [...new Set(decryptedMessages.map(msg => msg.sender_id))];
    const profileCollectionName = `${profile_type}profiles`;
    const channelProfiles = await db.collection(profileCollectionName)
      .find({ user_id: { $in: channelSenderIds } })
      .project({ user_id: 1, display_name: 1 })
      .toArray();
    const channelProfileMap = new Map(channelProfiles.map(p => [p.user_id, p.display_name]));
    const enrichedMessages = decryptedMessages.map(msg => ({
      ...msg,
      sender_display_name: channelProfileMap.get(msg.sender_id) && channelProfileMap.get(msg.sender_id).trim()
        ? channelProfileMap.get(msg.sender_id)
        : '[NO PROFILE NAME]'
    }));

    return NextResponse.json({ 
      success: true, 
      messages: enrichedMessages,
      profile_type
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
    const { content, attachments, reply_to, profile_type = 'basic' } = await req.json();

    if (!content || content.trim() === '') {
      return NextResponse.json({ 
        error: 'Message content is required' 
      }, { status: 400 });
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

    // OPTIMIZATION 3: Combine membership and channel checks in parallel
    const [membership, channel] = await Promise.all([
      db.collection(membersCollection).findOne({
        group_id: groupId,
        user_id: auth.userId
      }, { projection: { _id: 1 } }),
      db.collection(channelsCollection).findOne({
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
    const message: Record<string, unknown> = {
      message_id: messageId,
      group_id: groupId,
      channel_id: channelId,
      sender_id: auth.userId,
      content: encryptedContent,
      timestamp: new Date().toISOString(),
      edited: false,
      attachments: attachments || [],
      is_pinned: false
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

    // Fetch sender's profile display name based on the group's profile type
    const profilesCollection = profile_type === 'basic' ? 'basicprofiles' : `${profile_type}profiles`;
    const senderProfile = await db.collection(profilesCollection).findOne(
      { user_id: auth.userId },
      { projection: { display_name: 1 } }
    );
    
    const senderDisplayName = senderProfile?.display_name || auth.user.username || 'Unknown';

    // Send SSE notification to all group members
    await notifyNewGroupMessage({
      message_id: messageId,
      group_id: groupId,
      channel_id: channelId,
      sender_id: auth.userId,
      content: content, // Use unencrypted content for notification
      timestamp: message.timestamp as string,
      attachments: attachments || [],
      sender_username: auth.user.username, // Keep username for backward compatibility
      sender_display_name: senderDisplayName, // Use profile display name based on group type
      profile_type: profile_type // Include profile type for SSE notification
    });

    return NextResponse.json({ 
      success: true, 
      message: { ...message, content, encrypted_content: undefined },
      profile_type
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
    const { messageId, message_id, profile_type = 'basic' } = body;

    // Handle both field names - frontend might send either messageId or message_id
    const actualMessageId = messageId || message_id;

    if (!actualMessageId) {
      return NextResponse.json({ error: 'Missing messageId or message_id' }, { status: 400 });
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

    // Try to find the message by message_id first (UUID), then by _id (ObjectId) if needed
    let message = await db.collection(messagesCollection).findOne({
      message_id: actualMessageId,
      group_id: groupId,
      channel_id: channelId
    });

    // If not found by message_id and actualMessageId looks like an ObjectId, try _id
    if (!message && actualMessageId.length === 24) {
      try {
        const { ObjectId } = await import('mongodb');
        const objectId = new ObjectId(actualMessageId);
        message = await db.collection(messagesCollection).findOne({
          _id: objectId,
          group_id: groupId,
          channel_id: channelId
        });
      } catch {
        // Invalid ObjectId format, continue with message_id search
      }
    }

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const membership = await db.collection(membersCollection).findOne({
      group_id: groupId,
      user_id: auth.userId
    });

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

    // Delete by the same field we found the message with
    const deleteQuery: Record<string, unknown> = {
      group_id: groupId,
      channel_id: channelId
    };

    if (message._id && actualMessageId.length === 24) {
      deleteQuery._id = message._id;
    } else {
      deleteQuery.message_id = message.message_id;
    }

    const result = await db.collection(messagesCollection).deleteOne(deleteQuery);

    return NextResponse.json({ 
      success: true, 
      deleted: result.deletedCount > 0,
      profile_type
    });

  } catch {
    console.error('Error deleting channel message');
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
