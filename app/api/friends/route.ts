import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../mongo-uri';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

const client = new MongoClient(MONGODB_URI);

// GET: List friends and friend requests for the current user
export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    await client.connect();
    const db = client.db('polmatch');
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const user_id = session.user_id;
    // Get friends
    const friends = await db.collection('friends').find({ $or: [ { user_id }, { friend_id: user_id } ], status: 'accepted' }).toArray();
    // Get incoming requests
    const incoming = await db.collection('friends').find({ friend_id: user_id, status: 'pending' }).toArray();
    // Get outgoing requests
    const outgoing = await db.collection('friends').find({ user_id, status: 'pending' }).toArray();
    return NextResponse.json({ success: true, user_id, friends, incoming, outgoing });
  } catch (err) {
    console.error('Error in GET /api/friends:', err);
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : 'Failed to fetch friends', error: String(err) });
  } finally {
    // Do not close the client here to allow connection pooling
  }
}
