import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import { getAuthenticatedUser } from '../../../lib/mongodb-connection';
import { notifyIncomingCall, notifyCallStatusUpdate, VoiceCallData } from '../../../lib/sse-notifications';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

interface CallNotification {
  call_id: string;
  caller_id: string;
  recipient_id: string;
  channel_name: string;
  call_type: 'voice' | 'video';
  status: 'calling' | 'accepted' | 'declined' | 'ended' | 'missed';
  created_at: Date;
  updated_at: Date;
}

// POST: Initiate a voice call
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recipient_id, channel_name, call_type = 'voice' } = await request.json();

    if (!recipient_id || !channel_name) {
      return NextResponse.json({ 
        error: 'Missing required fields: recipient_id, channel_name' 
      }, { status: 400 });
    }

    const client = new MongoClient(MONGODB_URI as string);
    
    try {
      await client.connect();
      const db = client.db('polmatch');

      // Check if recipient exists
      const recipient = await db.collection('users').findOne({ user_id: recipient_id });
      if (!recipient) {
        return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
      }

      // Get caller info for notification
      const callerProfile = await db.collection('basicprofiles').findOne(
        { user_id: auth.user.user_id },
        { projection: { display_name: 1 } }
      );

      // Create call notification
      const callNotification: CallNotification = {
        call_id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        caller_id: auth.user.user_id,
        recipient_id,
        channel_name,
        call_type,
        status: 'calling',
        created_at: new Date(),
        updated_at: new Date()
      };

      // Store call notification in database for reference
      await db.collection('call_notifications').insertOne(callNotification);

      // Send SSE notification to recipient
      const callData: VoiceCallData = {
        call_id: callNotification.call_id,
        caller_id: auth.user.user_id,
        caller_username: auth.user.username,
        caller_display_name: callerProfile?.display_name,
        recipient_id,
        channel_name,
        call_type,
        status: 'calling',
        created_at: callNotification.created_at.toISOString()
      };

      await notifyIncomingCall(callData);

      return NextResponse.json({
        success: true,
        call_id: callNotification.call_id,
        channel_name,
        message: 'Call initiated successfully'
      });

    } finally {
      await client.close();
    }

  } catch (error) {
    console.error('Error initiating call:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// PATCH: Update call status (accept, decline, end)
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { call_id, status, other_user_id } = await request.json();

    if (!call_id || !status) {
      return NextResponse.json({ 
        error: 'Missing required fields: call_id, status' 
      }, { status: 400 });
    }

    if (!['accepted', 'declined', 'ended', 'missed'].includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status. Must be: accepted, declined, ended, or missed' 
      }, { status: 400 });
    }

    const client = new MongoClient(MONGODB_URI as string);
    
    try {
      await client.connect();
      const db = client.db('polmatch');

      let call;
      
      // If call_id is "unknown", try to find the most recent active call
      if (call_id === 'unknown' && other_user_id) {
        console.log('Call ID unknown, searching for active call with other user:', other_user_id);
        call = await db.collection('call_notifications').findOne({
          $or: [
            { caller_id: auth.user.user_id, recipient_id: other_user_id },
            { caller_id: other_user_id, recipient_id: auth.user.user_id }
          ],
          status: { $in: ['calling', 'accepted'] }, // Only active calls
          created_at: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Within last 5 minutes
        }, { sort: { created_at: -1 } }); // Most recent first
        
        if (call) {
          console.log('Found active call:', call.call_id);
        } else {
          console.log('No active call found');
        }
      } else {
        // Get the call notification by call_id
        call = await db.collection('call_notifications').findOne({
          call_id,
          $or: [
            { caller_id: auth.user.user_id },
            { recipient_id: auth.user.user_id }
          ]
        });
      }

      if (!call) {
        return NextResponse.json({ 
          error: 'Call not found or unauthorized' 
        }, { status: 404 });
      }

      // Update call status
      await db.collection('call_notifications').updateOne(
        { call_id: call.call_id }, // Use the actual call_id from the found call
        {
          $set: {
            status,
            updated_at: new Date()
          }
        }
      );

      // Get caller info for notification
      const callerProfile = await db.collection('basicprofiles').findOne(
        { user_id: call.caller_id },
        { projection: { display_name: 1 } }
      );

      const callerUser = await db.collection('users').findOne(
        { user_id: call.caller_id },
        { projection: { username: 1 } }
      );

      // Send SSE notification about status update
      const callData: VoiceCallData = {
        call_id: call.call_id,
        caller_id: call.caller_id,
        caller_username: callerUser?.username || 'Unknown',
        caller_display_name: callerProfile?.display_name,
        recipient_id: call.recipient_id,
        channel_name: call.channel_name,
        call_type: call.call_type,
        status: status as 'calling' | 'accepted' | 'declined' | 'ended' | 'missed',
        created_at: call.created_at.toISOString()
      };

      await notifyCallStatusUpdate(callData);

      return NextResponse.json({
        success: true,
        message: `Call status updated to ${status}`
      });

    } finally {
      await client.close();
    }

  } catch (error) {
    console.error('Error updating call status:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
