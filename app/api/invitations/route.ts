import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../mongo-uri';
import { cookies } from 'next/headers';

let client: MongoClient | null = null;

async function connectToDatabase(): Promise<MongoClient> {
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  return client;
}

// Get all pending invitations for the current user
export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dbClient = await connectToDatabase();
    const db = dbClient.db('polmatch');
    
    // Verify session
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Get all pending invitations for this user
    const invitations = await db.collection('group_invitations')
      .find({ 
        invited_user_id: session.user_id,
        status: 'pending'
      })
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json({ 
      success: true, 
      invitations 
    });

  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
