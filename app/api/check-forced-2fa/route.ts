import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser } from '../../../lib/mongodb-connection';

/**
 * GET /api/check-forced-2fa
 * Returns whether the current user is required to complete forced 2FA setup.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ force_2fa_enabled: false }, { status: 200 });
    }

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ force_2fa_enabled: false }, { status: 200 });
    }

    // Only force 2FA if flagged and not yet completed
    const shouldForce2FA: boolean =
      Boolean(auth.user.force_2fa_enabled) && !Boolean(auth.user.two_factor_enabled);

    return NextResponse.json({ force_2fa_enabled: shouldForce2FA }, { status: 200 });
  } catch (error) {
    console.error('Error in check-forced-2fa route:', error);
    return NextResponse.json({ force_2fa_enabled: false }, { status: 500 });
  }
}
