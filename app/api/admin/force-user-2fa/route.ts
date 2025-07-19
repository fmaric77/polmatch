import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

export async function POST(request: Request) {
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
    
    // Verify session and admin status
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const adminUser = await db.collection('users').findOne({ user_id: session.user_id });
    if (!adminUser || !adminUser.is_admin) {
      return NextResponse.json({ success: false, message: 'Admin only' }, { status: 403 });
    }

    // Get user_id from request body
    const { user_id } = await request.json();
    if (!user_id) {
      return NextResponse.json({ success: false, message: 'User ID is required' }, { status: 400 });
    }

    // Check if target user exists
    const targetUser = await db.collection('users').findOne({ user_id });
    if (!targetUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Don't force 2FA on admins
    if (targetUser.is_admin) {
      return NextResponse.json({ success: false, message: 'Cannot force 2FA on admin users' }, { status: 400 });
    }

    // Check if user already has 2FA enabled
    if (targetUser.two_factor_enabled) {
      return NextResponse.json({ success: false, message: 'User already has 2FA enabled' }, { status: 400 });
    }

    // Update the specific user to have force_2fa_enabled = true
    const result = await db.collection('users').updateOne(
      { user_id },
      { 
        $set: { 
          force_2fa_enabled: true,
          force_2fa_date: new Date(),
          forced_by_admin: adminUser.user_id
        } 
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to update user' 
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully forced 2FA for user ${targetUser.username}`,
      username: targetUser.username
    });

  } catch (err) {
    console.error('Error forcing individual user 2FA:', err);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to force 2FA', 
      error: String(err) 
    });
  } finally {
    await client.close();
  }
}
