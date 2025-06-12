import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser, getProfilePicture } from '../../../../lib/mongodb-connection';

// GET: Fetch profile picture URL for a specific user
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    // Fast authentication using cached connection and session cache
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Missing user_id' }, { status: 400 });
    }
    
    // Optimized profile picture lookup using single aggregation query
    const profilePictureUrl = await getProfilePicture(userId);
    
    const response = NextResponse.json({ 
      success: true, 
      profile_picture_url: profilePictureUrl,
      user_id: userId 
    });

    // Add caching headers to reduce repeated requests
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300'); // 5 minutes
    response.headers.set('ETag', `"${userId}-${Date.now()}"`);
    
    return response;
  } catch (err) {
    console.error('Profile picture API error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) }, { status: 500 });
  }
}
