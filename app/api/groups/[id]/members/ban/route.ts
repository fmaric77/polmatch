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
    const { user_id, reason } = await req.json();

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
        error: 'Only group admins can ban members' 
      }, { status: 403 });
    }

    // Prevent banning the group creator
    if (group.creator_id === user_id) {
      await client.close();
      return NextResponse.json({ 
        error: 'Cannot ban the group creator' 
      }, { status: 400 });
    }

    // Check if user is already banned
    const existingBan = await db.collection('group_bans').findOne({
      group_id: groupId,
      user_id: user_id
    });

    if (existingBan) {
      await client.close();
      return NextResponse.json({ 
        error: 'User is already banned from this group' 
      }, { status: 400 });
    }

    // Remove user from group if they are a member
    const targetMembership = await db.collection('group_members').findOne({
      group_id: groupId,
      user_id: user_id
    });

    if (targetMembership) {
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
    }

    // Add ban record
    await db.collection('group_bans').insertOne({
      group_id: groupId,
      user_id: user_id,
      banned_by: session.user_id,
      banned_at: new Date(),
      reason: reason || 'No reason provided'
    });

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: 'User banned successfully' 
    });

  } catch (error) {
    console.error('Error banning user:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
