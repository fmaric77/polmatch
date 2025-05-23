import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../mongo-uri';
import { cookies } from 'next/headers';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
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

    // Check if user is a member of the group
    const membership = await db.collection('group_members').findOne({
      group_id: groupId,
      user_id: session.user_id
    });

    if (!membership) {
      await client.close();
      return NextResponse.json({ 
        error: 'Not a member of this group' 
      }, { status: 403 });
    }

    // Get group members with user details
    const members = await db.collection('group_members').aggregate([
      { $match: { group_id: groupId } },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: 'user_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          user_id: 1,
          role: 1,
          join_date: 1,
          username: '$user.username'
        }
      },
      { $sort: { join_date: 1 } }
    ]).toArray();

    await client.close();

    return NextResponse.json({ 
      success: true, 
      members 
    });

  } catch (error) {
    console.error('Error fetching group members:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
