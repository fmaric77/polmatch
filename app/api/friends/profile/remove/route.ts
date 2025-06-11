import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../../lib/mongodb-connection';

// POST: Remove a friend from a specific profile type
export async function POST(request: NextRequest): Promise<NextResponse> {
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

    const body = await request.json();
    const { friend_id, profile_type } = body as { 
      friend_id: string; 
      profile_type: 'basic' | 'love' | 'business' 
    };

    if (!friend_id || !profile_type) {
      return NextResponse.json({ 
        success: false, 
        message: 'friend_id and profile_type are required' 
      }, { status: 400 });
    }

    if (!['basic', 'love', 'business'].includes(profile_type)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    const user_id = session.user_id;
    const collectionName = `friends_${profile_type}`;

    // Remove the friendship (works both ways)
    const result = await db.collection(collectionName).deleteOne({
      $or: [
        { user_id, friend_id, status: 'accepted' },
        { user_id: friend_id, friend_id: user_id, status: 'accepted' }
      ]
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        message: `Not friends on ${profile_type} profile` 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Friend removed from ${profile_type} profile` 
    });

  } catch (error) {
    console.error('Error removing friend:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to remove friend' 
    }, { status: 500 });
  }
}
