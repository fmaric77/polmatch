import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import MONGODB_URI from '../../mongo-uri';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

const client = new MongoClient(MONGODB_URI);

// POST: Accept or reject a friend request
export async function POST(req: NextRequest) {
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
    const { requester_id, action } = await req.json(); // action: 'accept' | 'reject'
    if (!requester_id || !['accept', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
    }
    const request = await db.collection('friends').findOne({ user_id: requester_id, friend_id: user_id, status: 'pending' });
    if (!request) {
      return NextResponse.json({ success: false, message: 'No such friend request' }, { status: 404 });
    }
    if (action === 'accept') {
      await db.collection('friends').updateOne({ user_id: requester_id, friend_id: user_id }, { $set: { status: 'accepted', accepted_at: new Date() } });
      return NextResponse.json({ success: true, message: 'Friend request accepted' });
    } else {
      await db.collection('friends').deleteOne({ user_id: requester_id, friend_id: user_id });
      return NextResponse.json({ success: true, message: 'Friend request rejected' });
    }
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to respond', error: String(err) });
  } finally {
    // Do not close the client to keep pool open
  }
}
