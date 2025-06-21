import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';


if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

export async function DELETE(req: NextRequest) {
  return await leaveGroup(req);
}

export async function POST(req: NextRequest) {
  return await leaveGroup(req);
}

async function leaveGroup(req: NextRequest) {
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

    const { group_id, profile_type } = await req.json();

    if (!group_id) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group ID is required' 
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
    const groupsCollection = groupProfileType === 'basic' ? 'groups' : `groups_${groupProfileType}`;
    const membersCollection = groupProfileType === 'basic' ? 'group_members' : `group_members_${groupProfileType}`;

    // Check if user is a member of the group
    const membership = await db.collection(membersCollection).findOne({
      group_id: group_id,
      user_id: session.user_id
    });

    if (!membership) {
      await client.close();
      return NextResponse.json({ 
        error: 'You are not a member of this group' 
      }, { status: 400 });
    }

    // Check if user is the group creator/owner
    const group = await db.collection(groupsCollection).findOne({ group_id: group_id });
    if (group && group.creator_id === session.user_id) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group owners cannot leave their own group. Delete the group instead.' 
      }, { status: 400 });
    }

    // Remove user from group
    await db.collection(membersCollection).deleteOne({
      group_id: group_id,
      user_id: session.user_id
    });

    // Update group member count
    const remainingMembersCount = await db.collection(membersCollection).countDocuments({
      group_id: group_id
    });

    await db.collection(groupsCollection).updateOne(
      { group_id: group_id },
      { 
        $set: { 
          member_count: remainingMembersCount,
          last_activity: new Date()
        }
      }
    );

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully left the group',
      profile_type: groupProfileType
    });

  } catch (error) {
    console.error('Error leaving group:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
