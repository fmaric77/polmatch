import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';
import { notifyStatusChange } from '../../../../lib/sse-notifications';

export type UserStatus = 'online' | 'away' | 'dnd' | 'offline';

interface StatusUpdateData {
  status: UserStatus;
  custom_message?: string;
}

// GET: Get user status
export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Invalid session' }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get('user_id');
    
    // If no user_id specified, return current user's status
    const userId = targetUserId || session.user_id;
    
    const user = await db.collection('users').findOne({ user_id: userId });
    
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      status: user.status || 'offline',
      custom_message: user.status_message || null,
      last_seen: user.last_seen || null
    });
    
  } catch (error) {
    console.error('Error fetching user status:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// POST: Update user status
export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Invalid session' }, { status: 401 });
    }
    
    const body: StatusUpdateData = await request.json();
    const { status, custom_message } = body;
    
    // Validate status
    if (!['online', 'away', 'dnd', 'offline'].includes(status)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid status. Must be one of: online, away, dnd, offline' 
      }, { status: 400 });
    }
    
    const userId = session.user_id;
    const now = new Date().toISOString();
    
    // Update user status in database
    const updateData: {
      status: UserStatus;
      last_seen: string;
      status_updated_at: string;
      status_message?: string;
    } = {
      status,
      last_seen: now,
      status_updated_at: now
    };
    
    if (custom_message !== undefined) {
      updateData.status_message = custom_message;
    }
    
    await db.collection('users').updateOne(
      { user_id: userId },
      { $set: updateData }
    );
    
    // Get user info for notification
    const user = await db.collection('users').findOne({ user_id: userId });
    
    // Notify all friends and conversation participants about status change
    await notifyStatusChange({
      user_id: userId,
      username: user?.username || 'Unknown',
      status,
      custom_message,
      timestamp: now
    });
    
    return NextResponse.json({
      success: true,
      status,
      custom_message,
      last_seen: now
    });
    
  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Automatically set user to offline when they disconnect
export async function PUT() {
  try {
    const { db } = await connectToDatabase();
    
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Invalid session' }, { status: 401 });
    }
    
    const userId = session.user_id;
    const now = new Date().toISOString();
    
    // Set user to offline
    await db.collection('users').updateOne(
      { user_id: userId },
      { 
        $set: { 
          status: 'offline',
          last_seen: now,
          status_updated_at: now
        }
      }
    );
    
    // Get user info for notification
    const user = await db.collection('users').findOne({ user_id: userId });
    
    // Notify about offline status
    await notifyStatusChange({
      user_id: userId,
      username: user?.username || 'Unknown',
      status: 'offline',
      timestamp: now
    });
    
    return NextResponse.json({
      success: true,
      status: 'offline',
      last_seen: now
    });
    
  } catch (error) {
    console.error('Error setting user offline:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
} 