import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';

export async function GET() {
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

    // Get user's group memberships
    const memberships = await db.collection('group_members').find({
      user_id: session.user_id
    }).toArray();

    const groupIds = memberships.map(m => m.group_id);

    // Get group details
    const groups = await db.collection('groups').find({
      group_id: { $in: groupIds }
    }).sort({ last_activity: -1 }).toArray();

    // Add user's role to each group
    const groupsWithRoles = groups.map(group => {
      const membership = memberships.find(m => m.group_id === group.group_id);
      return {
        ...group,
        user_role: membership?.role || 'member'
      };
    });

    await client.close();

    return NextResponse.json({ 
      success: true, 
      groups: groupsWithRoles 
    });

  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
