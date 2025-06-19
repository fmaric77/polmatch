import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';


if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

export async function GET(req: NextRequest) {
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

    const url = new URL(req.url);
    const searchQuery = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build match query for public groups that user is not already a member of
    const matchQuery: Record<string, unknown> = {
      is_private: false
    };

    // Escape regex special characters in search query
    function escapeRegex(str: string): string {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    // Add text search if provided and not just whitespace
    if (searchQuery && searchQuery.trim().length > 0) {
      const safeQuery = escapeRegex(searchQuery.trim());
      matchQuery.$or = [
        { name: { $regex: safeQuery, $options: 'i' } },
        { description: { $regex: safeQuery, $options: 'i' } },
        { topic: { $regex: safeQuery, $options: 'i' } }
      ];
    } else {
      // Make sure $or is not present if search is empty
      if (matchQuery.$or) delete matchQuery.$or;
    }

    // Get groups the user is already a member of
    const userMemberships = await db.collection('group_members').find({
      user_id: session.user_id
    }).toArray();
    
    const userGroupIds: string[] = [];
    for (const membership of userMemberships) {
      const membershipDoc = membership as unknown as { group_id: string };
      userGroupIds.push(membershipDoc.group_id);
    }

    // Exclude groups the user is already a member of
    if (userGroupIds.length > 0) {
      matchQuery.group_id = { $nin: userGroupIds };
    }



    // Get public groups with aggregation pipeline
    const groups = await db.collection('groups').aggregate([
      { $match: matchQuery },
      { $sort: { members_count: -1, last_activity: -1 } }, // Sort by popularity then activity
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'creator_id',
          foreignField: 'user_id',
          as: 'creator',
          pipeline: [
            { $project: { username: 1, user_id: 1 } }
          ]
        }
      },
      { $unwind: '$creator' },
      {
        $project: {
          _id: 0,
          group_id: 1,
          name: 1,
          description: 1,
          topic: 1,
          members_count: 1,
          creation_date: 1,
          last_activity: 1,
          creator_username: '$creator.username',
          creator_id: 1
        }
      }
    ]).toArray();

    // Get total count for pagination
    const totalCount = await db.collection('groups').countDocuments(matchQuery);
    const totalPages = Math.ceil(totalCount / limit);

    await client.close();

    return NextResponse.json({
      success: true,
      groups,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error discovering groups:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
