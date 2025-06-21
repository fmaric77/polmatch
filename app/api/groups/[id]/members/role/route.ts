import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../../mongo-uri';
import { cookies } from 'next/headers';


if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

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
    const { user_id, role, profile_type } = await req.json();

    if (!user_id || !role) {
      await client.close();
      return NextResponse.json({ 
        error: 'User ID and role are required' 
      }, { status: 400 });
    }

    // Default to basic if not specified, validate profile_type
    const groupProfileType = profile_type || 'basic';
    if (!['basic', 'love', 'business'].includes(groupProfileType)) {
      await client.close();
      return NextResponse.json({ 
        error: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    // Use profile-specific collections
    const membersCollection = groupProfileType === 'basic' ? 'group_members' : `group_members_${groupProfileType}`;
    const groupsCollection = groupProfileType === 'basic' ? 'groups' : `groups_${groupProfileType}`;

    if (!['admin', 'member'].includes(role)) {
      await client.close();
      return NextResponse.json({ 
        error: 'Role must be either admin or member' 
      }, { status: 400 });
    }

    // Check if group exists
    const group = await db.collection(groupsCollection).findOne({ group_id: groupId });
    if (!group) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }

    // Check if requester is the group creator (only creators can assign/remove admins)
    if (group.creator_id !== session.user_id) {
      await client.close();
      return NextResponse.json({ 
        error: 'Only the group creator can assign administrators' 
      }, { status: 403 });
    }

    // Check if target user is a member
    const targetMembership = await db.collection(membersCollection).findOne({
      group_id: groupId,
      user_id: user_id
    });

    if (!targetMembership) {
      await client.close();
      return NextResponse.json({ 
        error: 'User is not a member of this group' 
      }, { status: 400 });
    }

    // Prevent changing the role of the group creator
    if (group.creator_id === user_id) {
      await client.close();
      return NextResponse.json({ 
        error: 'Cannot change the role of the group creator' 
      }, { status: 400 });
    }

    // Update user role
    await db.collection(membersCollection).updateOne(
      {
        group_id: groupId,
        user_id: user_id
      },
      {
        $set: { 
          role: role,
          role_updated_at: new Date(),
          role_updated_by: session.user_id
        }
      }
    );

    // Update group last activity
    await db.collection(groupsCollection).updateOne(
      { group_id: groupId },
      { $set: { last_activity: new Date() } }
    );

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: `User role updated to ${role} successfully` 
    });

  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
