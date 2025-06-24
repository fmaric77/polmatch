import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import speakeasy from 'speakeasy';
import CryptoJS from 'crypto-js';
import MONGODB_URI from '../../../mongo-uri';

const SECRET_KEY = process.env.SECRET_KEY || 'default-secret-key';

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

    const { code } = await req.json();

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Please provide a valid 6-digit code' }, { status: 400 });
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

    // Check if user has a temporary secret from setup
    if (!user.two_factor_temp_secret) {
      await client.close();
      return NextResponse.json({ error: 'No 2FA setup in progress. Please start setup first.' }, { status: 400 });
    }

    // Decrypt the temporary secret
    const decryptedSecret = CryptoJS.AES.decrypt(user.two_factor_temp_secret, SECRET_KEY).toString(CryptoJS.enc.Utf8);

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: code,
      window: 1 // Allow 1 step of time drift (30 seconds)
    });

    if (!verified) {
      await client.close();
      return NextResponse.json({ error: 'Invalid code. Please try again.' }, { status: 400 });
    }

    // Code is valid - enable 2FA
    await db.collection('users').updateOne(
      { user_id: session.user_id },
      { 
        $set: { 
          two_factor_enabled: true,
          two_factor_verified: true,
          two_factor_secret: user.two_factor_temp_secret // Move temp secret to permanent
        },
        $unset: {
          two_factor_temp_secret: '' // Remove temporary secret
        }
      }
    );

    await client.close();

    return NextResponse.json({
      success: true,
      message: '2FA has been successfully enabled on your account!'
    });

  } catch (error) {
    console.error('Error verifying 2FA:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 