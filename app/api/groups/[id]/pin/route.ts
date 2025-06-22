import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, connectToDatabase } from '../../../../../lib/mongodb-connection';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = request.cookies;
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fast authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;
    const { message_id, channel_id } = await request.json();
    
    if (!message_id) {
      console.log('❌ Missing message_id');
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Check if user is a member of the group in any profile collection
    const memberCollections = ['group_members', 'group_members_love', 'group_members_business'];
    let membership = null;
    
    for (const collection of memberCollections) {
      membership = await db.collection(collection).findOne({
        group_id: groupId,
        user_id: auth.userId
      });
      if (membership) break;
    }

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    // For now, only allow admins/owners to pin messages. You can modify this logic as needed
    if (membership.role !== 'admin' && membership.role !== 'owner') {
      return NextResponse.json({ error: 'Insufficient permissions to pin messages' }, { status: 403 });
    }

    // Determine which group_messages collection contains the message (basic, love, or business)
    const profileCollections = ['group_messages', 'group_messages_love', 'group_messages_business'];
    let updateResult;
    let targetCollection: string | null = null;
    
    console.log('🔍 Searching for message in collections...');
    
    for (const coll of profileCollections) {
      const query = { message_id: message_id, group_id: groupId, ...(channel_id && { channel_id }) };
      console.log(`🔍 Checking collection ${coll} with query:`, query);
      
      // First check if message exists
      const existingMessage = await db.collection(coll).findOne(query);
      console.log(`🔍 Message found in ${coll}:`, !!existingMessage);
      
      updateResult = await db.collection(coll).updateOne(
        query,
        { $set: { is_pinned: true, pinned_at: new Date().toISOString(), pinned_by: auth.userId } }
      );
      
      console.log(`🔍 Update result for ${coll}:`, { matchedCount: updateResult.matchedCount, modifiedCount: updateResult.modifiedCount });
      
      if (updateResult.matchedCount > 0) {
        targetCollection = coll;
        break;
      }
    }
    
    if (!targetCollection) {
      console.log('❌ Message not found in any collection');
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    
    console.log('✅ Message found and updated in collection:', targetCollection);
    // Get the updated message from the correct collection
    const message = await db.collection(targetCollection).findOne({ message_id: message_id, group_id: groupId, ...(channel_id && { channel_id }) });

    return NextResponse.json({
      success: true,
      message: {
        message_id: message?.message_id,
        is_pinned: message?.is_pinned,
        pinned_at: message?.pinned_at,
        pinned_by: message?.pinned_by
      }
    });

  } catch (error) {
    console.error('Error pinning message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = request.cookies;
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fast authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { message_id, channel_id } = await request.json();
    if (!message_id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    const resolvedParams = await params;
    const groupId = resolvedParams.id;
    const { db } = await connectToDatabase();

    // Check if user is a member of the group in any profile collection
    const memberCollections = ['group_members', 'group_members_love', 'group_members_business'];
    let membership = null;
    
    for (const collection of memberCollections) {
      membership = await db.collection(collection).findOne({
        group_id: groupId,
        user_id: auth.userId
      });
      if (membership) break;
    }

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    // For now, only allow admins/owners to unpin messages. You can modify this logic as needed
    if (membership.role !== 'admin' && membership.role !== 'owner') {
      return NextResponse.json({ error: 'Insufficient permissions to unpin messages' }, { status: 403 });
    }

    // Determine which group_messages collection contains the pinned message (basic, love, or business)
    const profileCollections = ['group_messages', 'group_messages_love', 'group_messages_business'];
    let updateResult;
    let targetCollection: string | null = null;
    for (const coll of profileCollections) {
      updateResult = await db.collection(coll).updateOne(
        {
          message_id: message_id,
          group_id: groupId,
          ...(channel_id && { channel_id: channel_id })
        },
        {
          $unset: { is_pinned: "", pinned_at: "", pinned_by: "" }
        }
      );
      if (updateResult.matchedCount > 0) {
        targetCollection = coll;
        break;
      }
    }
    if (!targetCollection) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message_id: message_id
    });

  } catch (error) {
    console.error('Error unpinning message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
