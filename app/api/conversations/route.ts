import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';

const uri = process.env.MONGODB_URI || '';

// GET: Fetch conversation states for current user
export async function GET() {
  const client = new MongoClient(uri);
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    await client.connect();
    const db = client.db('polmatch');
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    // Get all conversation states for this user
    const states = await db.collection('conversation_states').find({ 
      user_id: user.user_id 
    }).toArray();

    return NextResponse.json({ success: true, states });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}

// POST: Create or update conversation state
export async function POST(request: NextRequest) {
  const client = new MongoClient(uri);
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    await client.connect();
    const db = client.db('polmatch');
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { other_user_id, conversation_type, state } = body;

    if (!other_user_id || !conversation_type || !state) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    const conversation_id = conversation_type === 'direct' 
      ? `${user.user_id}_${other_user_id}_direct`
      : other_user_id; // For groups, use group_id as conversation_id

    const now = new Date();

    // Upsert conversation state
    await db.collection('conversation_states').updateOne(
      { 
        user_id: user.user_id, 
        other_user_id,
        conversation_type 
      },
      {
        $set: {
          conversation_id,
          state,
          updated_at: now
        },
        $setOnInsert: {
          created_at: now,
          last_message_at: now
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}

// PATCH: Update last message time for conversation
export async function PATCH(request: NextRequest) {
  const client = new MongoClient(uri);
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    await client.connect();
    const db = client.db('polmatch');
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { other_user_id, conversation_type } = body;

    if (!other_user_id || !conversation_type) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    const now = new Date();

    // Update last message time for both participants
    const participants = [user.user_id, other_user_id];
    
    for (const participant of participants) {
      const otherParticipant = participant === user.user_id ? other_user_id : user.user_id;
      
      await db.collection('conversation_states').updateOne(
        { 
          user_id: participant, 
          other_user_id: otherParticipant,
          conversation_type 
        },
        {
          $set: {
            last_message_at: now,
            updated_at: now
          },
          $setOnInsert: {
            conversation_id: conversation_type === 'direct' 
              ? `${participant}_${otherParticipant}_direct`
              : other_user_id,
            state: 'visible',
            created_at: now
          }
        },
        { upsert: true }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}
