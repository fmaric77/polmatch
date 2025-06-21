import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser, connectToDatabase } from '../../../../../../lib/mongodb-connection';

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

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();

    const params = await context.params;
    const groupId = params.id;
    const channelId = params.channelId;

    // Get profile_type from query parameters
    const url = new URL(req.url);
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

    // Check if user is a member of the group with admin privileges
    const membership = await db.collection(membersCollection).findOne({
      group_id: groupId,
      user_id: auth.user.user_id
    });

    if (!membership) {
      return NextResponse.json({ 
        error: 'Not a member of this group' 
      }, { status: 403 });
    }

    // Only owners can delete channels
    if (membership.role !== 'owner') {
      return NextResponse.json({ 
        error: 'Only group owners can delete channels' 
      }, { status: 403 });
    }

    // Get the channel to verify it exists and check if it's default
    const channel = await db.collection(channelsCollection).findOne({
      channel_id: channelId,
      group_id: groupId
    });

    if (!channel) {
      return NextResponse.json({ 
        error: 'Channel not found' 
      }, { status: 404 });
    }

    // Prevent deletion of default channels
    if (channel.is_default) {
      return NextResponse.json({ 
        error: 'Cannot delete the default channel' 
      }, { status: 400 });
    }

    // Delete all messages in the channel first
    const deletedMessages = await db.collection(messagesCollection).deleteMany({
      group_id: groupId,
      channel_id: channelId
    });

    // Delete the channel
    const deletedChannel = await db.collection(channelsCollection).deleteOne({
      channel_id: channelId,
      group_id: groupId
    });

    if (deletedChannel.deletedCount === 0) {
      return NextResponse.json({ 
        error: 'Failed to delete channel' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Channel deleted successfully',
      deletedMessages: deletedMessages.deletedCount,
      profile_type
    });

  } catch (error) {
    console.error('Error deleting channel:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
