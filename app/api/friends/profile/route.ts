import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';

interface FriendRequest {
  user_id: string;
  friend_id: string;
  profile_type: 'basic' | 'love' | 'business';
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  accepted_at?: string;
}

// GET: List friends and friend requests for a specific profile type
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

    const user_id = session.user_id;
    const collectionName = `friends_${profileType}`;

    // Get friends for this profile type
    const friends = await db.collection(collectionName).find({ 
      $or: [{ user_id }, { friend_id: user_id }], 
      status: 'accepted' 
    }).toArray();

    // Get incoming requests for this profile type
    const incoming = await db.collection(collectionName).find({ 
      friend_id: user_id, 
      status: 'pending' 
    }).toArray();

    // Get outgoing requests for this profile type
    const outgoing = await db.collection(collectionName).find({ 
      user_id, 
      status: 'pending' 
    }).toArray();

    return NextResponse.json({ 
      success: true, 
      profile_type: profileType,
      user_id, 
      friends, 
      incoming, 
      outgoing 
    });

  } catch (error) {
    console.error('Error in GET /api/friends/profile:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch friends' 
    }, { status: 500 });
  }
}

// POST: Send a friend request for a specific profile type
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
    const { friend_id, profile_type } = body as { friend_id: string; profile_type: 'basic' | 'love' | 'business' };

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

    if (friend_id === user_id) {
      return NextResponse.json({ 
        success: false, 
        message: 'Cannot send friend request to yourself' 
      }, { status: 400 });
    }

    // Check if target user has that profile type
    const profileCollectionName = `${profile_type}profiles`;
    const targetProfile = await db.collection(profileCollectionName).findOne({ user_id: friend_id });
    if (!targetProfile) {
      return NextResponse.json({ 
        success: false, 
        message: `User does not have a ${profile_type} profile` 
      }, { status: 404 });
    }

    // Check if sender has that profile type
    const senderProfile = await db.collection(profileCollectionName).findOne({ user_id });
    if (!senderProfile) {
      return NextResponse.json({ 
        success: false, 
        message: `You do not have a ${profile_type} profile` 
      }, { status: 400 });
    }

    const collectionName = `friends_${profile_type}`;

    // Check if already friends or pending request exists
    const existing = await db.collection(collectionName).findOne({
      $or: [
        { user_id, friend_id },
        { user_id: friend_id, friend_id: user_id }
      ]
    });

    if (existing) {
      return NextResponse.json({ 
        success: false, 
        message: 'Already friends or request pending for this profile type' 
      }, { status: 400 });
    }

    // Create friend request
    const friendRequest: FriendRequest = {
      user_id,
      friend_id,
      profile_type,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    await db.collection(collectionName).insertOne(friendRequest);

    return NextResponse.json({ 
      success: true, 
      message: `Friend request sent for ${profile_type} profile` 
    });

  } catch (error) {
    console.error('Error sending friend request:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to send friend request' 
    }, { status: 500 });
  }
}
