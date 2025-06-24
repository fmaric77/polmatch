import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import speakeasy from 'speakeasy';
import CryptoJS from 'crypto-js';
import MONGODB_URI from '../../../mongo-uri';

const SECRET_KEY = process.env.SECRET_KEY as string;
if (!SECRET_KEY) {
  throw new Error('SECRET_KEY environment variable is not defined');
}

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
    
    console.log('2FA Debug Info:');
    console.log('- User has temp secret:', !!user.two_factor_temp_secret);
    console.log('- Encrypted secret length:', user.two_factor_temp_secret?.length || 0);
    console.log('- SECRET_KEY being used:', SECRET_KEY.substring(0, 8) + '...');
    console.log('- Decrypted secret length:', decryptedSecret.length);
    console.log('- Decrypted secret preview:', decryptedSecret.substring(0, 8) + '...');
    console.log('- User entered code:', code);
    console.log('- Current server time:', new Date().toISOString());

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: code,
      window: 1 // Allow 1 step of time drift (30 seconds)
    });
    
    console.log('- TOTP verification result:', verified);
    
    // Also try with a wider window for debugging
    const verifiedWide = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: code,
      window: 3 // Allow 3 steps (±90 seconds)
    });
    
    console.log('- TOTP verification (wide window):', verifiedWide);
    
    // Generate what the server thinks the current code should be
    const serverCode = speakeasy.totp({
      secret: decryptedSecret,
      encoding: 'base32'
    });
    
    console.log('- Server calculated code:', serverCode);
    
    // Check codes for previous/next time windows
    const now = Math.floor(Date.now() / 1000);
    const step = 30; // TOTP step in seconds
    
    const prevCode = speakeasy.totp({
      secret: decryptedSecret,
      encoding: 'base32',
      time: now - step
    });
    
    const nextCode = speakeasy.totp({
      secret: decryptedSecret,
      encoding: 'base32', 
      time: now + step
    });
    
    console.log('- Previous window code (-30s):', prevCode);
    console.log('- Next window code (+30s):', nextCode);
    console.log('- User code matches any window:', [prevCode, serverCode, nextCode].includes(code));

    if (!verified) {
      await client.close();
      return NextResponse.json({ 
        error: 'Invalid code. Please try again.',
        debug: {
          serverCalculated: serverCode,
          userEntered: code,
          secretLength: decryptedSecret.length,
          serverTime: new Date().toISOString()
        }
      }, { status: 400 });
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