import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';

interface User {
  user_id: string;
  username: string;
  display_name?: string;
  profile_type?: string;
}

// GET: Fetch users who have a specific profile type
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    
    // Verify session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const profileType = url.searchParams.get('profile_type') as 'basic' | 'love' | 'business';
    
    if (!profileType || !['basic', 'love', 'business'].includes(profileType)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Valid profile_type parameter is required (basic, love, or business)' 
      }, { status: 400 });
    }

    const currentUserId = session.user_id;
    const profileCollectionName = `${profileType}profiles`;

    // Get all users who have the specified profile type
    const profileUsers = await db.collection(profileCollectionName)
      .find({}, { projection: { user_id: 1, display_name: 1, visibility: 1 } })
      .toArray();

    if (profileUsers.length === 0) {
      return NextResponse.json({ 
        success: true, 
        users: [] 
      });
    }

    // Get full user information for these users
    const userIds = profileUsers.map((profile: { user_id: string }) => profile.user_id);
    const users = await db.collection('users')
      .find(
        { 
          user_id: { $in: userIds, $ne: currentUserId } // Exclude current user
        },
        { projection: { user_id: 1, username: 1 } }
      )
      .toArray();

    // Combine user data with profile data
    const usersWithProfileData = users.map((user: { user_id: string; username: string }) => {
      const profile = profileUsers.find((p: { user_id: string }) => p.user_id === user.user_id);
      return {
        user_id: user.user_id,
        username: user.username,
        display_name: profile?.display_name || user.username,
        profile_type: profileType
      };
    });

    return NextResponse.json({ 
      success: true, 
      users: usersWithProfileData,
      profile_type: profileType
    });

  } catch (error) {
    console.error('Error fetching profile users:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch users' 
    }, { status: 500 });
  }
}
