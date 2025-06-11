import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser, connectToDatabase } from '../../../../lib/mongodb-connection';

interface UserWithProfile {
  user_id: string;
  username: string;
  display_name?: string;
  bio?: string;
  profile_picture_url?: string;
  visibility: string;
}

// GET: Discover users with specific profile types for messaging
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const url = new URL(request.url);
    const profileType = url.searchParams.get('profile_type') as 'basic' | 'love' | 'business' | null;
    const senderProfileType = url.searchParams.get('sender_profile_type') as 'basic' | 'love' | 'business' | null;

    if (!profileType) {
      return NextResponse.json({ success: false, message: 'Profile type is required' }, { status: 400 });
    }

    // Get the appropriate collection for the profile type
    let profileCollection: string;
    switch (profileType) {
      case 'basic':
        profileCollection = 'basicprofiles';
        break;
      case 'love':
        profileCollection = 'loveprofiles';
        break;
      case 'business':
        profileCollection = 'businessprofiles';
        break;
      default:
        return NextResponse.json({ success: false, message: 'Invalid profile type' }, { status: 400 });
    }

    // First, check if the current user has the sender profile type they want to use
    if (senderProfileType) {
      let senderCollection: string;
      switch (senderProfileType) {
        case 'basic':
          senderCollection = 'basicprofiles';
          break;
        case 'love':
          senderCollection = 'loveprofiles';
          break;
        case 'business':
          senderCollection = 'businessprofiles';
          break;
        default:
          return NextResponse.json({ success: false, message: 'Invalid sender profile type' }, { status: 400 });
      }

      const senderProfile = await db.collection(senderCollection).findOne({ user_id: auth.user.user_id });
      if (!senderProfile) {
        return NextResponse.json({ 
          success: false, 
          message: `You need to create a ${senderProfileType} profile before starting conversations with it` 
        }, { status: 400 });
      }
    }

    // Get users who have the specified profile type and are visible
    const profiles = await db.collection(profileCollection).find({
      user_id: { $ne: auth.user.user_id }, // Exclude current user
      visibility: { $in: ['public', 'friends'] } // Only public or friends-visible profiles
    }).toArray();

    if (profiles.length === 0) {
      return NextResponse.json({ success: true, users: [] });
    }

    // Get user details for these profiles
    const userIds = profiles.map(profile => profile.user_id);
    const users = await db.collection('users').find({
      user_id: { $in: userIds }
    }).toArray();

    // Check which users are friends for friend-only profiles
    const friendships = await db.collection('friendships').find({
      $or: [
        { requester_id: auth.user.user_id, status: 'accepted' },
        { friend_id: auth.user.user_id, status: 'accepted' }
      ]
    }).toArray();

    const friendIds = new Set(
      friendships.map(friendship => 
        friendship.requester_id === auth.user.user_id 
          ? friendship.friend_id 
          : friendship.requester_id
      )
    );

    // Combine user and profile data, filtering by visibility rules
    const usersWithProfiles: UserWithProfile[] = [];
    
    for (const user of users) {
      const profile = profiles.find(p => p.user_id === user.user_id);
      if (!profile) continue;

      // Apply visibility rules
      const isPublic = profile.visibility === 'public';
      const isFriend = friendIds.has(user.user_id);
      const canSeeProfile = isPublic || (profile.visibility === 'friends' && isFriend);

      if (canSeeProfile) {
        usersWithProfiles.push({
          user_id: user.user_id,
          username: user.username,
          display_name: profile.display_name,
          bio: profile.bio,
          profile_picture_url: profile.profile_picture_url,
          visibility: profile.visibility
        });
      }
    }

    // Sort by username for consistent ordering
    usersWithProfiles.sort((a, b) => a.username.localeCompare(b.username));

    return NextResponse.json({ 
      success: true, 
      users: usersWithProfiles,
      profile_type: profileType
    });

  } catch (error) {
    console.error('Error discovering users:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Server error', 
      error: String(error) 
    }, { status: 500 });
  }
}
