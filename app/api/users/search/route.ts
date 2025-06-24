import { NextResponse } from 'next/server';
import { connectToDatabase, getAuthenticatedUser } from '../../../../lib/mongodb-connection';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Get session token from cookies
    const cookieHeader = request.headers.get('cookie');
    const sessionToken = cookieHeader
      ?.split(';')
      .find(c => c.trim().startsWith('session='))
      ?.split('=')[1];

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: No session token' },
        { status: 401 }
      );
    }

    // Authenticate user
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Invalid session' },
        { status: 401 }
      );
    }

    const { userId } = auth;

    // Get search query from URL parameters
    const url = new URL(request.url);
    const searchQuery = url.searchParams.get('q');

    if (!searchQuery || searchQuery.trim().length < 2) {
      return NextResponse.json(
        { success: false, message: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Search users by username or email (case-insensitive)
    const searchRegex = new RegExp(searchQuery.trim(), 'i');
    
    const users = await db.collection('users').find({
      $and: [
        { user_id: { $ne: userId } }, // Exclude current user
        { account_status: 'active' }, // Only active accounts
        {
          $or: [
            { username: { $regex: searchRegex } },
            { email: { $regex: searchRegex } }
          ]
        }
      ]
    })
    .project({
      user_id: 1,
      username: 1,
      email: 1,
      _id: 0
    })
    .limit(50) // Limit results
    .toArray();

    // Get display names from profiles for each user
    const usersWithProfiles = await Promise.all(
      users.map(async (user) => {
        // Try to get display name from basic profile first, then love, then business
        const basicProfile = await db.collection('basicprofiles').findOne(
          { user_id: user.user_id },
          { projection: { display_name: 1 } }
        );
        
        if (basicProfile?.display_name) {
          return { ...user, display_name: basicProfile.display_name };
        }

        const loveProfile = await db.collection('loveprofiles').findOne(
          { user_id: user.user_id },
          { projection: { display_name: 1 } }
        );
        
        if (loveProfile?.display_name) {
          return { ...user, display_name: loveProfile.display_name };
        }

        const businessProfile = await db.collection('businessprofiles').findOne(
          { user_id: user.user_id },
          { projection: { display_name: 1 } }
        );
        
        if (businessProfile?.display_name) {
          return { ...user, display_name: businessProfile.display_name };
        }

        // Fallback to username if no display name found
        return { ...user, display_name: user.username };
      })
    );

    return NextResponse.json(
      { 
        success: true, 
        users: usersWithProfiles,
        total: usersWithProfiles.length
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('User search API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
