import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser, connectToDatabase } from '../../../../lib/mongodb-connection';

export async function GET(request: NextRequest) {
  try {
    // Fast authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get profile_type from query parameters
    const url = new URL(request.url);
    const profile_type = url.searchParams.get('profile_type') || 'basic';

    // Validate profile_type
    if (!['basic', 'love', 'business'].includes(profile_type)) {
      return NextResponse.json({ 
        error: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Use profile-specific collections
    const membersCollection = profile_type === 'basic' ? 'group_members' : `group_members_${profile_type}`;
    const groupsCollection = profile_type === 'basic' ? 'groups' : `groups_${profile_type}`;

    // Use aggregation pipeline for efficient query with profile-specific collections
    const groupsWithRoles = await db.collection(membersCollection).aggregate([
      { $match: { user_id: auth.user.user_id } },
      {
        $lookup: {
          from: groupsCollection,
          localField: 'group_id',
          foreignField: 'group_id',
          as: 'group_details'
        }
      },
      { $unwind: '$group_details' },
      {
        $project: {
          _id: 0,
          group_id: '$group_details.group_id',
          name: '$group_details.name',
          description: '$group_details.description',
          creator_id: '$group_details.creator_id',
          is_private: '$group_details.is_private',
          topic: '$group_details.topic',
          created_at: '$group_details.created_at',
          created_by: '$group_details.created_by',
          last_activity: '$group_details.last_activity',
          member_count: '$group_details.member_count',
          profile_type: '$group_details.profile_type',
          user_role: '$role'
        }
      },
      { $sort: { last_activity: -1 } }
    ]).toArray();

    return NextResponse.json({ 
      success: true, 
      groups: groupsWithRoles,
      profile_type 
    });

  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
