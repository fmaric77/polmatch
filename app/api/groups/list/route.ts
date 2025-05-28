import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser, connectToDatabase } from '../../../../lib/mongodb-connection';

export async function GET() {
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

    const { db } = await connectToDatabase();

    // Use aggregation pipeline for efficient query
    const groupsWithRoles = await db.collection('group_members').aggregate([
      { $match: { user_id: auth.user.user_id } },
      {
        $lookup: {
          from: 'groups',
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
          user_role: '$role'
        }
      },
      { $sort: { last_activity: -1 } }
    ]).toArray();

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
