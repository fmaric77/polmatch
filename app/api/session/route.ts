import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser } from '../../../lib/mongodb-connection';

export async function GET(): Promise<NextResponse> {
  try {
    // Auth check using optimized connection and caching
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      // Return 200 with valid: false instead of 401 to prevent browser console errors
      return NextResponse.json({ valid: false, message: 'No session token found' }, { status: 200 });
    }

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      // Return 200 with valid: false instead of 401 to prevent browser console errors
      return NextResponse.json({ valid: false, message: 'Invalid session token' }, { status: 200 });
    }

    return NextResponse.json({ 
      valid: true, 
      sessionToken: sessionToken, // Include session token for SSE connection
      user: {
        user_id: auth.user.user_id,
        username: auth.user.username,
        email: auth.user.email,
        is_admin: auth.user.is_admin,
        is_superadmin: auth.user.is_superadmin,
        account_status: auth.user.account_status,
        two_factor_enabled: auth.user.two_factor_enabled || false,
      }
    });
  } catch (err) {
    console.error('Session API error:', err);
    return NextResponse.json({ valid: false, message: 'Server error' }, { status: 500 });
  }
}
