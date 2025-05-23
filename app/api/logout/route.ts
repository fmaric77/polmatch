import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://filip:UIOfFTSe4Z7zHbxQ@cluster0.9wkt8p3.mongodb.net/';
const client = new MongoClient(uri);

export async function POST() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (sessionToken) {
      await client.connect();
      const db = client.db('polmatch');
      await db.collection('sessions').deleteOne({ sessionToken });
    }
    // Remove the session cookie
    cookieStore.set('session', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) });
  } finally {
    await client.close();
  }
}
