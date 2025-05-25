import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../../mongo-uri';
import { cookies } from 'next/headers';

interface RouteContext {
  params: Promise<{ id: string; channelId: string }>;
}

// DELETE: Delete a specific channel in a group
export async function DELETE(req: NextRequest, context: RouteContext): Promise<NextResponse> {
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

    // Check if user is a member of the group with admin privileges
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

    // Only owners can delete channels
    if (membership.role !== 'owner') {
      await client.close();
      return NextResponse.json({ 
        error: 'Only group owners can delete channels' 
      }, { status: 403 });
    }

    // Get the channel to verify it exists and check if it's default
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

    // Prevent deletion of default channels
    if (channel.is_default) {
      await client.close();
      return NextResponse.json({ 
        error: 'Cannot delete the default channel' 
      }, { status: 400 });
    }

    // Delete all messages in the channel first
    const deletedMessages = await db.collection('group_messages').deleteMany({
      group_id: groupId,
      channel_id: channelId
    });

    // Delete the channel
    const deletedChannel = await db.collection('group_channels').deleteOne({
      channel_id: channelId,
      group_id: groupId
    });

    await client.close();

    if (deletedChannel.deletedCount === 0) {
      return NextResponse.json({ 
        error: 'Failed to delete channel' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Channel deleted successfully',
      deletedMessages: deletedMessages.deletedCount
    });

  } catch (error) {
    console.error('Error deleting channel:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
