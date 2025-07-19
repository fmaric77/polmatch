import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

export async function POST() {
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

    // Update all users without 2FA to have force_2fa_enabled = true
    const result = await db.collection('users').updateMany(
      { 
        two_factor_enabled: { $ne: true },
        is_admin: { $ne: true } // Don't force admins
      },
      { 
        $set: { 
          force_2fa_enabled: true,
          force_2fa_date: new Date()
        } 
      }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully forced 2FA for users without it',
      affectedUsers: result.modifiedCount
    });

  } catch (err) {
    console.error('Error forcing 2FA:', err);
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to force 2FA', 
      error: String(err) 
    });
  } finally {
    await client.close();
  }
}
