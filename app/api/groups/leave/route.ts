import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';

export async function DELETE(req: NextRequest) {
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

    // Check if user is a member
    const membership = await db.collection('group_members').findOne({
      group_id,
      user_id: session.user_id
    });

    if (!membership) {
      await client.close();
      return NextResponse.json({ 
        error: 'Not a member of this group' 
      }, { status: 400 });
    }

    // Check if user is the creator/admin
    const group = await db.collection('groups').findOne({ group_id });
    
    if (!group) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }

    if (group.creator_id === session.user_id) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group creator cannot leave the group. Delete the group instead.' 
      }, { status: 400 });
    }

    // Remove user from group
    await db.collection('group_members').deleteOne({
      group_id,
      user_id: session.user_id
    });

    // Update group member count
    await db.collection('groups').updateOne(
      { group_id },
      { 
        $inc: { members_count: -1 },
        $set: { last_activity: new Date() }
      }
    );

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully left group' 
    });

  } catch (error) {
    console.error('Error leaving group:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
