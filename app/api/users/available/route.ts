import { NextResponse, NextRequest } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';

const client = new MongoClient(MONGODB_URI);

// Get list of users available for inviting (excluding current user and group members)
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // Verify session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const groupId = url.searchParams.get('group_id');

    let query: Record<string, unknown> = { user_id: { $ne: session.user_id } };

    // If group_id is provided, exclude users who are already members of that group
    if (groupId) {
      // Get existing group members
      const existingMembers = await db.collection('group_members')
        .find({ group_id: groupId }, { projection: { user_id: 1 } })
        .toArray();
      
      const memberUserIds = existingMembers.map(member => member.user_id);
      
      // Exclude current user and existing group members
      query = {
        user_id: { 
          $ne: session.user_id,
          $nin: memberUserIds 
        }
      };
    }

    // Get all users except the current user and existing group members (if group_id provided)
    const users = await db.collection('users')
      .find(query, { projection: { user_id: 1, username: 1 } })
      .toArray();

    return NextResponse.json({ 
      success: true, 
      users 
    });

  } catch (error) {
    console.error('Error fetching available users:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  } finally {
    await client.close();
  }
}
