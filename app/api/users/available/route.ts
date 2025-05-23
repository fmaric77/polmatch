import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';

const client = new MongoClient(MONGODB_URI);

// Get list of users available for inviting (excluding current user and group members)
export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await client.connect();
    const db = client.db('polmatch');
    
    // Verify session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Get all users except the current user
    const users = await db.collection('users')
      .find(
        { user_id: { $ne: session.user_id } },
        { projection: { user_id: 1, username: 1 } }
      )
      .toArray();

    return NextResponse.json({ 
      success: true, 
      users 
    });

  } catch (error) {
    console.error('Error fetching available users:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  } finally {
    await client.close();
  }
}
