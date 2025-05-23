import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../mongo-uri';

const client = new MongoClient(MONGODB_URI);

export async function POST() {
  // Auth check
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  await client.connect();
  const db = client.db('polmatch');
  try {
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    // Remove the session from DB and cookie
    await db.collection('sessions').deleteOne({ sessionToken });
    cookieStore.set('session', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    // Ensure the cookie is set before responding
    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Set-Cookie': 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax',
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) });
  } finally {
    await client.close();
  }
}
