import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../../mongo-uri';
import { cookies } from 'next/headers';

interface RouteContext {
  params: Promise<{ id: string }>;
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
    const { user_id } = await req.json();

    if (!user_id) {
      await client.close();
      return NextResponse.json({ 
        error: 'User ID is required' 
      }, { status: 400 });
    }

    // Check if group exists
    const group = await db.collection('groups').findOne({ group_id: groupId });
    if (!group) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }

    // Check if requester is admin/owner
    const requesterMembership = await db.collection('group_members').findOne({
      group_id: groupId,
      user_id: session.user_id
    });

    const isAdmin = group.creator_id === session.user_id || 
                   (requesterMembership && (requesterMembership.role === 'owner' || requesterMembership.role === 'admin'));

    if (!isAdmin) {
      await client.close();
      return NextResponse.json({ 
        error: 'Only group admins can remove members' 
      }, { status: 403 });
    }

    // Check if target user is a member
    const targetMembership = await db.collection('group_members').findOne({
      group_id: groupId,
      user_id: user_id
    });

    if (!targetMembership) {
      await client.close();
      return NextResponse.json({ 
        error: 'User is not a member of this group' 
      }, { status: 400 });
    }

    // Prevent removing the group creator
    if (group.creator_id === user_id) {
      await client.close();
      return NextResponse.json({ 
        error: 'Cannot remove the group creator' 
      }, { status: 400 });
    }

    // Remove user from group
    await db.collection('group_members').deleteOne({
      group_id: groupId,
      user_id: user_id
    });

    // Update group member count
    await db.collection('groups').updateOne(
      { group_id: groupId },
      { 
        $inc: { members_count: -1 },
        $set: { last_activity: new Date() }
      }
    );

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: 'Member removed successfully' 
    });

  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
