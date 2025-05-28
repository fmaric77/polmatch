import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser, connectToDatabase } from '../../../../../lib/mongodb-connection';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Helper function to get sorted participant IDs
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// GET: Check if a direct conversation exists with a specific user
export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const params = await context.params;
    const otherUserId = params.id;

    if (!otherUserId) {
      return NextResponse.json({ 
        error: 'User ID is required' 
      }, { status: 400 });
    }

    // Check if the other user exists
    const otherUser = await db.collection('users').findOne({ user_id: otherUserId });
    if (!otherUser) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Check if conversation exists in private_conversations collection
    const sortedParticipants = getSortedParticipants(auth.user.user_id, otherUserId);
    const conversation = await db.collection('private_conversations').findOne({
      participant_ids: sortedParticipants
    });

    // Also check if there are any messages between these users
    const hasMessages = await db.collection('private_messages').findOne({
      $or: [
        { sender_id: auth.user.user_id, receiver_id: otherUserId },
        { sender_id: otherUserId, receiver_id: auth.user.user_id }
      ]
    });

    const exists = !!(conversation || hasMessages);

    return NextResponse.json({ 
      exists,
      conversation_id: conversation?._id || null,
      other_user: {
        user_id: otherUser.user_id,
        username: otherUser.username,
        first_name: otherUser.first_name,
        last_name: otherUser.last_name,
        profile_picture: otherUser.profile_picture
      }
    });

  } catch (error) {
    console.error('Error checking conversation:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
