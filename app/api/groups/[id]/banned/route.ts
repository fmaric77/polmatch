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

    // Check if user is a member of the group with admin privileges
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

    // Check if user has admin privileges
    const group = await db.collection('groups').findOne({ group_id: groupId });
    const isAdmin = group && (group.creator_id === session.user_id || 
                              (membership && (membership.role === 'owner' || membership.role === 'admin')));

    if (!isAdmin) {
      await client.close();
      return NextResponse.json({ 
        error: 'Only group admins can view banned users' 
      }, { status: 403 });
    }

    // Get banned users with user details
    const bannedUsers = await db.collection('group_bans').aggregate([
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
        $lookup: {
          from: 'users',
          localField: 'banned_by',
          foreignField: 'user_id',
          as: 'banned_by_user'
        }
      },
      { $unwind: '$banned_by_user' },
      {
        $project: {
          user_id: 1,
          username: '$user.username',
          banned_at: 1,
          banned_by: 1,
          banned_by_username: '$banned_by_user.username',
          reason: 1
        }
      },
      { $sort: { banned_at: -1 } }
    ]).toArray();

    await client.close();

    return NextResponse.json({ 
      success: true, 
      banned_users: bannedUsers 
    });

  } catch (error) {
    console.error('Error fetching banned users:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
