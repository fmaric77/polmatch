import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb-connection';
import { cookies } from 'next/headers';

// Get invitation counts across all profile types
export async function GET(): Promise<NextResponse> {
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

    const profileTypes = ['basic', 'love', 'business'];
    const summary: Record<string, number> = {};

    // Check each profile type for pending invitations
    for (const profileType of profileTypes) {
      const collectionName = profileType === 'basic' ? 'group_invitations' : `group_invitations_${profileType}`;
      
      const count = await db.collection(collectionName)
        .countDocuments({ 
          invited_user_id: session.user_id,
          status: 'pending'
        });
      
      summary[profileType] = count;
    }

    console.log('🔔 INVITATION SUMMARY for user:', session.user_id, summary);

    return NextResponse.json({ 
      success: true, 
      summary 
    });

  } catch (error) {
    console.error('Error fetching invitation summary:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
