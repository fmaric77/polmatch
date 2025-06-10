import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../../lib/mongodb-connection';

// POST: Accept or reject a profile-specific friend request
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
    const { requester_id, profile_type, action } = body as { 
      requester_id: string; 
      profile_type: 'basic' | 'love' | 'business';
      action: 'accept' | 'reject' 
    };

    if (!requester_id || !profile_type || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ 
        success: false, 
        message: 'requester_id, profile_type, and action (accept/reject) are required' 
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

    // Find the friend request
    const request_doc = await db.collection(collectionName).findOne({ 
      user_id: requester_id, 
      friend_id: user_id, 
      status: 'pending' 
    });

    if (!request_doc) {
      return NextResponse.json({ 
        success: false, 
        message: `No pending friend request found for ${profile_type} profile` 
      }, { status: 404 });
    }

    if (action === 'accept') {
      // Accept the friend request
      await db.collection(collectionName).updateOne(
        { user_id: requester_id, friend_id: user_id }, 
        { 
          $set: { 
            status: 'accepted', 
            accepted_at: new Date().toISOString() 
          } 
        }
      );
      
      return NextResponse.json({ 
        success: true, 
        message: `Friend request accepted for ${profile_type} profile` 
      });
    } else {
      // Reject the friend request (delete it)
      await db.collection(collectionName).deleteOne({ 
        user_id: requester_id, 
        friend_id: user_id 
      });
      
      return NextResponse.json({ 
        success: true, 
        message: `Friend request rejected for ${profile_type} profile` 
      });
    }

  } catch (error) {
    console.error('Error responding to friend request:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to respond to friend request' 
    }, { status: 500 });
  }
}
