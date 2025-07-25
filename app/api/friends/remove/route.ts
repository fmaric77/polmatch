import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectToDatabase } from '../../../../lib/mongodb-connection';

// POST: Remove a friend (unfriend)
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { db } = await connectToDatabase();
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const user_id = session.user_id;
    const { friend_id } = await req.json();
    if (!friend_id) {
      return NextResponse.json({ success: false, message: 'Invalid friend_id' }, { status: 400 });
    }
    const res = await db.collection('friends').deleteOne({
      $or: [
        { user_id, friend_id, status: 'accepted' },
        { user_id: friend_id, friend_id: user_id, status: 'accepted' }
      ]
    });
    if (res.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Not friends' }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: 'Friend removed' });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to remove friend', error: String(err) });
  }
}
