import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase, getAuthenticatedUser } from '../../../../lib/mongodb-connection';
import { ObjectId } from 'mongodb';

interface ReactionRequest {
  message_id: string;
  message_type: 'direct' | 'group';
  reaction_type: string; // emoji or reaction identifier
  group_id?: string;
  channel_id?: string;
}

// GET: Get reactions for a message
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('message_id');
    const messageType = searchParams.get('message_type') as 'direct' | 'group';

    if (!messageId || !messageType) {
      return NextResponse.json({ 
        success: false, 
        error: 'message_id and message_type are required' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Find reactions for this message
    const reactions = await db.collection('message_reactions').find({
      message_id: messageId,
      message_type: messageType
    }).toArray();

    // Group reactions by type and count them
    const reactionCounts = reactions.reduce((acc, reaction) => {
      const reactionType = reaction.reaction_type;
      if (!acc[reactionType]) {
        acc[reactionType] = {
          count: 0,
          users: [],
          user_reacted: false
        };
      }
      acc[reactionType].count++;
      acc[reactionType].users.push({
        user_id: reaction.user_id,
        username: reaction.username || 'Unknown'
      });
      if (reaction.user_id === auth.userId) {
        acc[reactionType].user_reacted = true;
      }
      return acc;
    }, {} as Record<string, { count: number; users: Array<{ user_id: string; username: string }>; user_reacted: boolean }>);

    return NextResponse.json({ 
      success: true, 
      reactions: reactionCounts 
    });

  } catch (error) {
    console.error('Error fetching reactions:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch reactions' 
    }, { status: 500 });
  }
}

// POST: Add or remove a reaction
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as ReactionRequest;
    const { message_id, message_type, reaction_type, group_id, channel_id } = body;

    if (!message_id || !message_type || !reaction_type) {
      return NextResponse.json({ 
        success: false, 
        error: 'message_id, message_type, and reaction_type are required' 
      }, { status: 400 });
    }

    if (!['direct', 'group'].includes(message_type)) {
      return NextResponse.json({ 
        success: false, 
        error: 'message_type must be either "direct" or "group"' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Verify the message exists and user has access to it
    if (message_type === 'direct') {
      // For direct messages, check if user is participant
      const messageCollection = 'pm';
      let messageQuery: Record<string, unknown>;
      
      // Handle both ObjectId and string message IDs
      if (ObjectId.isValid(message_id)) {
        messageQuery = { _id: new ObjectId(message_id) };
      } else {
        messageQuery = { message_id: message_id };
      }

      const message = await db.collection(messageCollection).findOne({
        ...messageQuery,
        $or: [
          { sender_id: auth.userId },
          { receiver_id: auth.userId }
        ]
      });

      if (!message) {
        return NextResponse.json({ 
          success: false, 
          error: 'Message not found or access denied' 
        }, { status: 404 });
      }
    } else if (message_type === 'group') {
      // For group messages, check if user is member of the group
      if (!group_id) {
        return NextResponse.json({ 
          success: false, 
          error: 'group_id is required for group messages' 
        }, { status: 400 });
      }

      const membership = await db.collection('groupmembers').findOne({
        group_id: group_id,
        user_id: auth.userId
      });

      if (!membership) {
        return NextResponse.json({ 
          success: false, 
          error: 'You are not a member of this group' 
        }, { status: 403 });
      }

      // Verify the group message exists
      const groupMessage = await db.collection('group_messages').findOne({
        message_id: message_id,
        group_id: group_id,
        ...(channel_id && { channel_id })
      });

      if (!groupMessage) {
        return NextResponse.json({ 
          success: false, 
          error: 'Group message not found' 
        }, { status: 404 });
      }
    }

    // Check if user already reacted with this reaction type
    const existingReaction = await db.collection('message_reactions').findOne({
      message_id: message_id,
      message_type: message_type,
      user_id: auth.userId,
      reaction_type: reaction_type
    });

    if (existingReaction) {
      // Remove the reaction (toggle off)
      await db.collection('message_reactions').deleteOne({
        _id: existingReaction._id
      });

      return NextResponse.json({ 
        success: true, 
        action: 'removed',
        message: 'Reaction removed successfully' 
      });
    } else {
      // Add the reaction
      const reactionDoc = {
        message_id: message_id,
        message_type: message_type,
        user_id: auth.userId,
        username: auth.user.username,
        reaction_type: reaction_type,
        created_at: new Date(),
        ...(group_id && { group_id }),
        ...(channel_id && { channel_id })
      };

      await db.collection('message_reactions').insertOne(reactionDoc);

      return NextResponse.json({ 
        success: true, 
        action: 'added',
        message: 'Reaction added successfully' 
      });
    }

  } catch (error) {
    console.error('Error handling reaction:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to handle reaction' 
    }, { status: 500 });
  }
}

// DELETE: Remove a specific reaction
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as ReactionRequest;
    const { message_id, message_type, reaction_type } = body;

    if (!message_id || !message_type || !reaction_type) {
      return NextResponse.json({ 
        success: false, 
        error: 'message_id, message_type, and reaction_type are required' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Remove the specific reaction
    const result = await db.collection('message_reactions').deleteOne({
      message_id: message_id,
      message_type: message_type,
      user_id: auth.userId,
      reaction_type: reaction_type
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Reaction not found' 
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Reaction removed successfully' 
    });

  } catch (error) {
    console.error('Error removing reaction:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to remove reaction' 
    }, { status: 500 });
  }
} 