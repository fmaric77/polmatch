import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb-connection';
import { cookies } from 'next/headers';

 // Get all pending invitations for the current user
 export async function GET(request: Request): Promise<NextResponse> {
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

     // Get profile_type from query parameters
     const { searchParams } = new URL(request.url);
     const profileType = searchParams.get('profile_type') || 'basic';

     console.log('🔔 INVITATIONS API - User:', session.user_id, 'Profile:', profileType);

     // Validate profile_type
     if (!['basic', 'love', 'business'].includes(profileType)) {
       return NextResponse.json({ success: false, message: 'Invalid profile type' }, { status: 400 });
     }

     // Use profile-specific collection
     const collectionName = `group_invitations_${profileType}`;

     console.log('🔔 INVITATIONS API - Searching collection:', collectionName);

     // Get all pending invitations for this user
     const invitations = await db.collection(collectionName)
       .find({ 
         invited_user_id: session.user_id,
         status: 'pending'
       })
       .sort({ created_at: -1 })
       .toArray();

     console.log('🔔 INVITATIONS API - Found invitations:', invitations.length, 'for user:', session.user_id);

     return NextResponse.json({ 
       success: true, 
       invitations 
     });

   } catch (error) {
     console.error('Error fetching invitations:', error);
     return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
   }
}
