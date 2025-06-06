import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

export async function GET() {
  // Auth check
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('polmatch');
    const users = await db.collection('users').find({}, { projection: { password_hash: 0 } }).toArray();
    return NextResponse.json({ success: true, users });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to fetch users', error: String(err) });
  } finally {
    await client.close();
  }
}
