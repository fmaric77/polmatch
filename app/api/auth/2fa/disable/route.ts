import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import MONGODB_URI from '../../../mongo-uri';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

export async function POST(req: NextRequest) {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required to disable 2FA' }, { status: 400 });
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('polmatch');

    // Verify session and get user
    const session = await db.collection('sessions').findOne({ 
      sessionToken: sessionToken 
    });
    
    if (!session) {
      await client.close();
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const user = await db.collection('users').findOne({ 
      user_id: session.user_id 
    });

    if (!user) {
      await client.close();
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if 2FA is enabled
    if (!user.two_factor_enabled) {
      await client.close();
      return NextResponse.json({ error: '2FA is not currently enabled' }, { status: 400 });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      await client.close();
      return NextResponse.json({ error: 'Incorrect password' }, { status: 400 });
    }

    // Disable 2FA
    await db.collection('users').updateOne(
      { user_id: session.user_id },
      { 
        $unset: { 
          two_factor_enabled: '',
          two_factor_verified: '',
          two_factor_secret: '',
          two_factor_temp_secret: ''
        }
      }
    );

    await client.close();

    return NextResponse.json({
      success: true,
      message: '2FA has been successfully disabled'
    });

  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 