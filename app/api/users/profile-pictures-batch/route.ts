import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser, getProfilePicture } from '../../../../lib/mongodb-connection';

// POST: Fetch profile picture URLs for multiple users in batch
export async function POST(request: Request): Promise<NextResponse> {
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
    
    const body = await request.json();
    const { user_ids } = body as { user_ids: string[] };
    
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ success: false, message: 'Missing or invalid user_ids array' }, { status: 400 });
    }
    
    // Limit batch size to prevent abuse
    if (user_ids.length > 100) {
      return NextResponse.json({ success: false, message: 'Maximum 100 user IDs allowed per batch' }, { status: 400 });
    }
    
    // Remove duplicates and invalid IDs
    const uniqueUserIds = [...new Set(user_ids.filter(id => typeof id === 'string' && id.trim()))];
    
    if (uniqueUserIds.length === 0) {
      return NextResponse.json({ success: true, profile_pictures: {} });
    }
    
    // Batch fetch all profile pictures
    const profilePicturePromises = uniqueUserIds.map(async (userId) => {
      try {
        const profilePictureUrl = await getProfilePicture(userId);
        return { userId, profilePictureUrl };
      } catch (error) {
        console.error(`Error fetching profile picture for user ${userId}:`, error);
        return { userId, profilePictureUrl: null };
      }
    });
    
    const results = await Promise.allSettled(profilePicturePromises);
    
    // Build response object
    const profilePictures: Record<string, string | null> = {};
    
    results.forEach((result, index) => {
      const userId = uniqueUserIds[index];
      if (result.status === 'fulfilled') {
        profilePictures[userId] = result.value.profilePictureUrl;
      } else {
        console.error(`Failed to fetch profile picture for user ${userId}:`, result.reason);
        profilePictures[userId] = null;
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      profile_pictures: profilePictures
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 minutes
        'ETag': `"batch-${uniqueUserIds.join(',')}-${Date.now()}"`
      }
    });
    
  } catch (err) {
    console.error('Batch profile picture API error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) }, { status: 500 });
  }
}
