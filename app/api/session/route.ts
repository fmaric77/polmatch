import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../mongo-uri';

const client = new MongoClient(MONGODB_URI);

export async function GET() {
  // Auth check
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ valid: false, message: 'Unauthorized' }, { status: 401 });
  }
  await client.connect();
  const db = client.db('polmatch');
  const session = await db.collection('sessions').findOne({ sessionToken });
  if (!session) {
    await client.close();
    return NextResponse.json({ valid: false, message: 'Unauthorized' }, { status: 401 });
  }
  // Fetch user info for admin check
  const user = await db.collection('users').findOne({ user_id: session.user_id });
  if (!user) {
    return NextResponse.json({ valid: false });
  }
  return NextResponse.json({ valid: true, user: {
    user_id: user.user_id,
    username: user.username,
    email: user.email,
    is_admin: user.is_admin,
    is_superadmin: user.is_superadmin,
    account_status: user.account_status,
  }});
}
