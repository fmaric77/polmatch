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

    // Get profile_type from query parameters
    const url = new URL(req.url);
    const profile_type = url.searchParams.get('profile_type') || 'basic';

    // Validate profile_type
    if (!['basic', 'love', 'business'].includes(profile_type)) {
      await client.close();
      return NextResponse.json({ 
        error: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    // Use profile-specific collections
    const membersCollection = profile_type === 'basic' ? 'group_members' : `group_members_${profile_type}`;

    // Check if user is a member of the group
    const membership = await db.collection(membersCollection).findOne({
      group_id: groupId,
      user_id: session.user_id
    });

    if (!membership) {
      await client.close();
      return NextResponse.json({ 
        error: 'Not a member of this group' 
      }, { status: 403 });
    }

    // Get group members with user details and profile-specific display names
    const members = await db.collection(membersCollection).aggregate([
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
          from: `${profile_type}profiles`,
          localField: 'user_id',
          foreignField: 'user_id',
          as: 'profile'
        }
      },
      {
        $project: {
          user_id: 1,
          role: 1,
          join_date: 1,
          username: '$user.username',
          display_name: { 
            $cond: { 
              if: { $and: [
                { $gt: [{ $size: '$profile' }, 0] },
                { $ne: [{ $arrayElemAt: ['$profile.display_name', 0] }, null] },
                { $ne: [{ $arrayElemAt: ['$profile.display_name', 0] }, ''] }
              ] }, 
              then: { $arrayElemAt: ['$profile.display_name', 0] }, 
              else: '[NO PROFILE NAME]'
            } 
          }
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
