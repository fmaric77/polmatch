import { NextResponse } from 'next/server';
import MONGODB_URI from '../../mongo-uri';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';

const client = new MongoClient(MONGODB_URI);

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  try {
    await client.connect();
    const db = client.db('polmatch');
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user?.is_admin) return NextResponse.json({ success: false, message: 'Forbidden: Admins only' }, { status: 403 });

    const { user_id, admin_id } = await request.json();
    if (!user_id || !admin_id) {
      return NextResponse.json({ success: false, message: 'Missing user_id or admin_id' }, { status: 400 });
    }
    // Find user to get IP address
    const userToBan = await db.collection('users').findOne({ user_id });
    if (!userToBan) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }
    // Add to ban collection
    await db.collection('ban').insertOne({
      ip_address: userToBan.ip_address,
      admin_id,
      ban_date: new Date().toISOString(),
    });
    
    // Clear all sessions from the banned IP address
    const sessionDeleteResult = await db.collection('sessions').deleteMany({
      ip_address: userToBan.ip_address
    });
    
    console.log(`Cleared ${sessionDeleteResult.deletedCount} sessions from banned IP: ${userToBan.ip_address}`);
    
    // Delete user
    await db.collection('users').deleteOne({ user_id });
    
    return NextResponse.json({ 
      success: true, 
      sessions_cleared: sessionDeleteResult.deletedCount 
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: String(err) }, { status: 500 });
  } finally {
    await client.close();
  }
}
