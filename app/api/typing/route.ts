import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthenticatedUser } from '../../../lib/mongodb-connection';
import { notifyTypingStart, notifyTypingStop } from '../../../lib/sse-notifications';

// POST: Start typing indicator
export async function POST(request: NextRequest): Promise<NextResponse> {
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

    const { conversation_id, conversation_type, channel_id, user_id, username } = await request.json();

    if (!conversation_id || !conversation_type || !user_id || !username) {
      return NextResponse.json({ 
        error: 'conversation_id, conversation_type, user_id, and username are required' 
      }, { status: 400 });
    }

    // Validate user matches authenticated user
    if (user_id !== auth.userId) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
    }

    // Create typing data
    const typingData = {
      user_id,
      username,
      conversation_id,
      conversation_type,
      channel_id: channel_id || undefined,
      timestamp: new Date().toISOString()
    };

    // Notify other users via SSE
    await notifyTypingStart(typingData);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in typing indicator POST:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// DELETE: Stop typing indicator
export async function DELETE(request: NextRequest): Promise<NextResponse> {
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

    const { conversation_id, conversation_type, channel_id, user_id } = await request.json();

    if (!conversation_id || !conversation_type || !user_id) {
      return NextResponse.json({ 
        error: 'conversation_id, conversation_type, and user_id are required' 
      }, { status: 400 });
    }

    // Validate user matches authenticated user
    if (user_id !== auth.userId) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
    }

    // Create typing data for stop event
    const typingData = {
      user_id,
      conversation_id,
      conversation_type,
      channel_id: channel_id || undefined
    };

    // Notify other users via SSE
    await notifyTypingStop(typingData);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in typing indicator DELETE:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
