import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import MONGODB_URI from '../../mongo-uri';

const client = new MongoClient(MONGODB_URI);

// POST: Send a friend request
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
    const { friend_id } = await req.json();
    if (!friend_id || friend_id === user_id) {
      return NextResponse.json({ success: false, message: 'Invalid friend_id' }, { status: 400 });
    }
    // Check if already friends or pending
    const existing = await db.collection('friends').findOne({
      $or: [
        { user_id, friend_id },
        { user_id: friend_id, friend_id: user_id }
      ]
    });
    if (existing) {
      return NextResponse.json({ success: false, message: 'Already friends or request pending' }, { status: 400 });
    }
    await db.collection('friends').insertOne({ user_id, friend_id, status: 'pending', created_at: new Date() });
    return NextResponse.json({ success: true, message: 'Friend request sent' });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to send request', error: String(err) });
  } finally {
    // Do not close the client to keep pool open
  }
}
