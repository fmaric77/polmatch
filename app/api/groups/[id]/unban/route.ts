import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../mongo-uri';
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
    const { user_id, profile_type = 'basic' } = await req.json();

    if (!user_id) {
      await client.close();
      return NextResponse.json({ 
        error: 'User ID is required' 
      }, { status: 400 });
    }

    // Validate profile_type
    if (!['basic', 'love', 'business'].includes(profile_type)) {
      await client.close();
      return NextResponse.json({ 
        error: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    // Use profile-specific collections
    const groupsCollection = profile_type === 'basic' ? 'groups' : `groups_${profile_type}`;
    const membersCollection = profile_type === 'basic' ? 'group_members' : `group_members_${profile_type}`;
    const bansCollection = profile_type === 'basic' ? 'group_bans' : `group_bans_${profile_type}`;

    // Check if group exists
    const group = await db.collection(groupsCollection).findOne({ group_id: groupId });
    if (!group) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }

    // Check if requester is admin/owner
    const requesterMembership = await db.collection(membersCollection).findOne({
      group_id: groupId,
      user_id: session.user_id
    });

    const isAdmin = group.creator_id === session.user_id || 
                   (requesterMembership && (requesterMembership.role === 'owner' || requesterMembership.role === 'admin'));

    if (!isAdmin) {
      await client.close();
      return NextResponse.json({ 
        error: 'Only group admins can unban members' 
      }, { status: 403 });
    }

    // Check if user is actually banned
    const existingBan = await db.collection(bansCollection).findOne({
      group_id: groupId,
      user_id: user_id
    });

    if (!existingBan) {
      await client.close();
      return NextResponse.json({ 
        error: 'User is not banned from this group' 
      }, { status: 400 });
    }

    // Remove ban record
    await db.collection(bansCollection).deleteOne({
      group_id: groupId,
      user_id: user_id
    });

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: 'User unbanned successfully',
      profile_type
    });

  } catch (error) {
    console.error('Error unbanning user:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
