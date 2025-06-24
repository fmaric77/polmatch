import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import CryptoJS from 'crypto-js';
import MONGODB_URI from '../../../mongo-uri';

const SECRET_KEY = process.env.SECRET_KEY || 'default-secret-key';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Check if 2FA is already enabled
    if (user.two_factor_enabled) {
      await client.close();
      return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 });
    }

    // Generate a new secret for the user
    const secret = speakeasy.generateSecret({
      name: `PolMatch (${user.username})`,
      issuer: 'PolMatch',
      length: 32
    });

    // Generate QR code
    if (!secret.otpauth_url) {
      await client.close();
      return NextResponse.json({ error: 'Failed to generate 2FA secret' }, { status: 500 });
    }
    
    const qrCodeDataURL = await QRCode.toDataURL(secret.otpauth_url);

    // Encrypt and temporarily store the secret (not yet enabled)
    const encryptedSecret = CryptoJS.AES.encrypt(secret.base32, SECRET_KEY).toString();
    
    await db.collection('users').updateOne(
      { user_id: session.user_id },
      { 
        $set: { 
          two_factor_temp_secret: encryptedSecret,
          two_factor_enabled: false,
          two_factor_verified: false
        } 
      }
    );

    await client.close();

    return NextResponse.json({
      success: true,
      qrCode: qrCodeDataURL,
      manualEntryKey: secret.base32,
      message: 'Scan the QR code with your authenticator app, then verify with a code to enable 2FA'
    });

  } catch (error) {
    console.error('Error setting up 2FA:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 