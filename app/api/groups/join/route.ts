import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';

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

    const { group_id } = await req.json();

    if (!group_id) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group ID is required' 
      }, { status: 400 });
    }

    // Check if group exists
    const group = await db.collection('groups').findOne({ group_id });
    
    if (!group) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }

    // Check if user is already a member
    const existingMembership = await db.collection('group_members').findOne({
      group_id,
      user_id: session.user_id
    });

    if (existingMembership) {
      await client.close();
      return NextResponse.json({ 
        error: 'Already a member of this group' 
      }, { status: 400 });
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
      role: 'member'
    };

    await db.collection('group_members').insertOne(membership);

    // Update group member count
    await db.collection('groups').updateOne(
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
