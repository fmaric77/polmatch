import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;
    const group_id = id;

    // Check if group exists and user is the creator
    const group = await db.collection('groups').findOne({ group_id });
    
    if (!group) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }

    // Check if user is creator (either by creator_id or by having owner/admin role)
    const membership = await db.collection('group_members').findOne({
      group_id,
      user_id: session.user_id
    });

    const isCreator = group.creator_id === session.user_id || 
                     (membership && (membership.role === 'owner' || membership.role === 'admin'));

    if (!isCreator) {
      await client.close();
      return NextResponse.json({ 
        error: 'Only the group creator can delete the group' 
      }, { status: 403 });
    }

    // Delete group and all related data
    await Promise.all([
      // Delete the group
      db.collection('groups').deleteOne({ group_id }),
      // Delete all group members
      db.collection('group_members').deleteMany({ group_id }),
      // Delete all group messages
      db.collection('group_messages').deleteMany({ group_id }),
      // Delete all group invitations
      db.collection('group_invitations').deleteMany({ group_id })
    ]);

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: 'Group successfully deleted' 
    });

  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
