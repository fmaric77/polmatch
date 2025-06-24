import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import CryptoJS from 'crypto-js';
import MONGODB_URI from '../../../mongo-uri';

const SECRET_KEY = process.env.SECRET_KEY as string;
if (!SECRET_KEY) {
  throw new Error('SECRET_KEY environment variable is not defined');
}

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
    
    console.log('2FA Setup Debug:');
    console.log('- Generated secret (base32):', secret.base32);
    console.log('- SECRET_KEY being used:', SECRET_KEY.substring(0, 8) + '...');
    console.log('- Encrypted secret length:', encryptedSecret.length);
    console.log('- QR URL:', secret.otpauth_url);
    
    // Test decryption immediately to verify it works
    const testDecrypt = CryptoJS.AES.decrypt(encryptedSecret, SECRET_KEY).toString(CryptoJS.enc.Utf8);
    console.log('- Test decrypt matches:', testDecrypt === secret.base32);
    
    // Extract and verify what's actually in the QR URL
    const urlMatch = secret.otpauth_url?.match(/secret=([A-Z2-7]+)/);
    const qrSecret = urlMatch ? urlMatch[1] : 'NOT_FOUND';
    console.log('- Secret in QR URL:', qrSecret);
    console.log('- QR secret matches generated:', qrSecret === secret.base32);
    
    // Test what TOTP code the server would generate right now
    const currentServerCode = speakeasy.totp({
      secret: secret.base32,
      encoding: 'base32'
    });
    console.log('- Current server code (fresh secret):', currentServerCode);
    
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