import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://filip:UIOfFTSe4Z7zHbxQ@cluster0.9wkt8p3.mongodb.net/';
const client = new MongoClient(uri);

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ valid: false });
    }
    await client.connect();
    const db = client.db('polmatch');
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ valid: false });
    }
    return NextResponse.json({ valid: true });
  } catch (err) {
    return NextResponse.json({ valid: false, error: String(err) });
  } finally {
    await client.close();
  }
}
