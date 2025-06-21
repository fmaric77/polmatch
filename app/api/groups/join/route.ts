import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';


if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

export async function POST(req: NextRequest) {
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
    const bansCollection = groupProfileType === 'basic' ? 'group_bans' : `group_bans_${groupProfileType}`;

    // Check if group exists
    const group = await db.collection(groupsCollection).findOne({ group_id });
    
    if (!group) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }

    // Check if user is already a member
    const existingMembership = await db.collection(membersCollection).findOne({
      group_id,
      user_id: session.user_id
    });

    if (existingMembership) {
      await client.close();
      return NextResponse.json({ 
        error: 'Already a member of this group' 
      }, { status: 400 });
    }

    // Check if user is banned from this group
    const banRecord = await db.collection(bansCollection).findOne({
      group_id,
      user_id: session.user_id
    });

    if (banRecord) {
      await client.close();
      return NextResponse.json({ 
        error: 'You are banned from this group' 
      }, { status: 403 });
    }

    // Check if group is private (might need invitation logic later)
    if (group.is_private) {
      await client.close();
      return NextResponse.json({ 
        error: 'Cannot join private group without invitation' 
      }, { status: 403 });
    }

    // Add user to group
    const membership = {
      group_id,
      user_id: session.user_id,
      join_date: new Date(),
      role: 'member',
      profile_type: groupProfileType
    };

    await db.collection(membersCollection).insertOne(membership);

    // Update group member count
    await db.collection(groupsCollection).updateOne(
      { group_id },
      { 
        $inc: { members_count: 1 },
        $set: { last_activity: new Date() }
      }
    );

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully joined group' 
    });

  } catch (error) {
    console.error('Error joining group:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
