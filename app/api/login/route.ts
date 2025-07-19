import { NextResponse } from 'next/server';
import { Db } from 'mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import speakeasy from 'speakeasy';
import CryptoJS from 'crypto-js';
import { connectToDatabase } from '../../../lib/mongodb-connection';
import { 
  validateEmail, 
  validateRequestBody,
  createValidationErrorResponse
} from '../../../lib/validation';
import { createSession, cleanupExpiredSessions } from '../../../lib/auth';

const SECRET_KEY = process.env.SECRET_KEY as string;
if (!SECRET_KEY) {
  throw new Error('SECRET_KEY environment variable is not defined');
}

// Brute force protection configuration
const BRUTE_FORCE_CONFIG = {
  MAX_ATTEMPTS: 5,           // Max attempts before lockout
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes in milliseconds
  PROGRESSIVE_DELAYS: [0, 1000, 2000, 5000, 10000], // Progressive delays in ms
  CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // Clean old records after 24 hours
};

// Helper function to get IP address
function getClientIP(request: Request): string {
  let ip_address = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('remote-addr') || 
                   'unknown';
  
  if (ip_address && ip_address.includes(',')) {
    ip_address = ip_address.split(',')[0].trim();
  }
  
  return ip_address;
}

// Check if IP or email is currently locked out
async function checkBruteForceProtection(db: Db, email: string, ip_address: string) {
  const now = new Date();
  
  // Check failed attempts for this IP and email
  const ipAttempts = await db.collection('login_attempts').findOne({
    ip_address,
    type: 'ip'
  });
  
  const emailAttempts = await db.collection('login_attempts').findOne({
    email: email.toLowerCase(),
    type: 'email'
  });
  
  // Check IP lockout
  if (ipAttempts && ipAttempts.locked_until && new Date(ipAttempts.locked_until) > now) {
    return {
      blocked: true,
      reason: 'IP temporarily blocked',
      locked_until: ipAttempts.locked_until,
      attempts: ipAttempts.attempts
    };
  }
  
  // Check email lockout
  if (emailAttempts && emailAttempts.locked_until && new Date(emailAttempts.locked_until) > now) {
    return {
      blocked: true,
      reason: 'Account temporarily locked',
      locked_until: emailAttempts.locked_until,
      attempts: emailAttempts.attempts
    };
  }
  
  // Return current attempt counts
  return {
    blocked: false,
    ip_attempts: ipAttempts?.attempts || 0,
    email_attempts: emailAttempts?.attempts || 0
  };
}

// Record failed login attempt
async function recordFailedAttempt(db: Db, email: string, ip_address: string, user_agent: string) {
  const now = new Date();
  
  // Record IP-based attempt
  const ipAttempt = await db.collection('login_attempts').findOne({
    ip_address,
    type: 'ip'
  });
  
  const ipAttempts = (ipAttempt?.attempts || 0) + 1;
  const ipLockedUntil = ipAttempts >= BRUTE_FORCE_CONFIG.MAX_ATTEMPTS ? new Date(now.getTime() + BRUTE_FORCE_CONFIG.LOCKOUT_DURATION) : null;
  
  await db.collection('login_attempts').updateOne(
    { ip_address, type: 'ip' },
    {
      $set: {
        ip_address,
        type: 'ip',
        attempts: ipAttempts,
        last_attempt: now,
        locked_until: ipLockedUntil,
        user_agent
      }
    },
    { upsert: true }
  );
  
  // Record email-based attempt
  const emailAttempt = await db.collection('login_attempts').findOne({
    email: email.toLowerCase(),
    type: 'email'
  });
  
  const emailAttempts = (emailAttempt?.attempts || 0) + 1;
  const emailLockedUntil = emailAttempts >= BRUTE_FORCE_CONFIG.MAX_ATTEMPTS ? new Date(now.getTime() + BRUTE_FORCE_CONFIG.LOCKOUT_DURATION) : null;
  
  await db.collection('login_attempts').updateOne(
    { email: email.toLowerCase(), type: 'email' },
    {
      $set: {
        email: email.toLowerCase(),
        type: 'email',
        attempts: emailAttempts,
        last_attempt: now,
        locked_until: emailLockedUntil,
        ip_address,
        user_agent
      }
    },
    { upsert: true }
  );
  
  return { ipAttempts, emailAttempts };
}

// Clear failed attempts on successful login
async function clearFailedAttempts(db: Db, email: string, ip_address: string) {
  await db.collection('login_attempts').deleteMany({
    $or: [
      { ip_address, type: 'ip' },
      { email: email.toLowerCase(), type: 'email' }
    ]
  });
}

// Clean up old login attempt records
async function cleanupOldAttempts(db: Db) {
  const cutoff = new Date(Date.now() - BRUTE_FORCE_CONFIG.CLEANUP_INTERVAL);
  await db.collection('login_attempts').deleteMany({
    last_attempt: { $lt: cutoff },
    locked_until: { $lt: new Date() }
  });
}

export async function POST(request: Request) {
  console.log('API /api/login called');
  try {
    // Parse and validate request body
    let body;
    try {
      body = await request.json();
      console.log('Request body parsed:', { 
        email: body.email ? 'provided' : 'missing', 
        password: body.password ? 'provided' : 'missing',
        twoFactorCode: body.twoFactorCode ? 'provided' : 'missing'
      });
    } catch {
      console.log('Failed to parse JSON request body');
      return createValidationErrorResponse('Invalid JSON in request body', 400);
    }

    // Validate request structure - twoFactorCode is optional
    const bodyValidation = validateRequestBody(body, ['email', 'password'], ['twoFactorCode']);
    if (!bodyValidation.isValid) {
      console.log('Body validation failed:', bodyValidation.error);
      return createValidationErrorResponse(bodyValidation.error!, 400);
    }

    const { email, password, twoFactorCode } = body;
    console.log('Email and password extracted from body');

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      console.log('Email validation failed:', emailValidation.error);
      return createValidationErrorResponse(emailValidation.error!, 400);
    }

    // Note: We don't validate password format here since we're just checking against hash
    // Password format validation is only needed during registration

    // Get client information
    const ip_address = getClientIP(request);
    const user_agent = request.headers.get('user-agent') || 'unknown';

    const { db } = await connectToDatabase();

    // Check if IP is banned before processing login
    const ipBan = await db.collection('ban').findOne({ ip_address });
    if (ipBan) {
      // Clear any existing sessions from this banned IP
      await db.collection('sessions').deleteMany({ ip_address });

      // Return custom HTML with skull and autoplay audio
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>💀</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              background: #000;
              color: #fff;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
            }
            .skull {
              font-size: 8rem;
              margin-bottom: 2rem;
              text-shadow: 0 0 16px #fff;
            }
          </style>
        </head>
        <body>
          <div class="skull">💀</div>
          <audio src="/sounds/ww.mp3" autoplay loop></audio>
        </body>
        </html>
        `,
        {
          status: 403,
          headers: {
            'Content-Type': 'text/html',
          },
        }
      );
    }

    // Clean up old attempts periodically (1% chance per request)
    if (Math.random() < 0.01) {
      cleanupOldAttempts(db);
    }

    // Check brute force protection
    const bruteForceCheck = await checkBruteForceProtection(db, email, ip_address);
    
    if (bruteForceCheck.blocked) {
      const timeRemaining = Math.ceil((new Date(bruteForceCheck.locked_until).getTime() - Date.now()) / 1000 / 60);
      return NextResponse.json({ 
        success: false, 
        message: `${bruteForceCheck.reason}. Try again in ${timeRemaining} minutes.`,
        locked_until: bruteForceCheck.locked_until,
        attempts: bruteForceCheck.attempts
      }, { status: 429 });
    }

    // Apply progressive delay based on previous attempts
    const maxAttempts = Math.max(bruteForceCheck.ip_attempts, bruteForceCheck.email_attempts);
    if (maxAttempts > 0 && maxAttempts < BRUTE_FORCE_CONFIG.PROGRESSIVE_DELAYS.length) {
      const delay = BRUTE_FORCE_CONFIG.PROGRESSIVE_DELAYS[maxAttempts];
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Check if the user exists
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (!user) {
      // Record failed attempt
      await recordFailedAttempt(db, email, ip_address, user_agent);
      return NextResponse.json({ success: false, message: 'Invalid email or password' }, { status: 401 });
    }

    // Check if account is banned or inactive
    if (user.account_status === 'banned') {
      await recordFailedAttempt(db, email, ip_address, user_agent);
      return NextResponse.json({ success: false, message: 'Account is banned' }, { status: 403 });
    }

    if (user.account_status === 'inactive') {
      await recordFailedAttempt(db, email, ip_address, user_agent);
      return NextResponse.json({ success: false, message: 'Account is inactive' }, { status: 403 });
    }

    // Check if the password matches
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      // Record failed attempt
      await recordFailedAttempt(db, email, ip_address, user_agent);
      return NextResponse.json({ success: false, message: 'Invalid email or password' }, { status: 401 });
    }

    // Check if 2FA is enabled for this user
    if (user.two_factor_enabled && user.two_factor_secret) {
      if (!twoFactorCode) {
        return NextResponse.json({ 
          success: false, 
          requires2FA: true,
          message: 'Two-factor authentication code required' 
        }, { status: 200 });
      }

      // Validate 2FA code format
      if (twoFactorCode.length !== 6 || !/^\d{6}$/.test(twoFactorCode)) {
        await recordFailedAttempt(db, email, ip_address, user_agent);
        return NextResponse.json({ 
          success: false, 
          requires2FA: true,
          message: 'Invalid 2FA code format. Please enter a 6-digit code.' 
        }, { status: 401 });
      }

      // Decrypt the user's 2FA secret
      const decryptedSecret = CryptoJS.AES.decrypt(user.two_factor_secret, SECRET_KEY).toString(CryptoJS.enc.Utf8);

      // Verify the 2FA code
      const verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 1 // Allow 1 step of time drift (30 seconds)
      });

      if (!verified) {
        await recordFailedAttempt(db, email, ip_address, user_agent);
        return NextResponse.json({ 
          success: false, 
          requires2FA: true,
          message: 'Invalid 2FA code. Please try again.' 
        }, { status: 401 });
      }
    }

    // Successful login - clear any failed attempts
    await clearFailedAttempts(db, email, ip_address);

    // Create a session using the new auth utility
    const sessionToken = await createSession({
      user_id: user.user_id,
      ip_address,
      user_agent: request.headers.get('User-Agent') || 'Unknown'
    });

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set('session', sessionToken, { 
      httpOnly: true, 
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 // 24 hours
    });

    // Clean up expired sessions periodically (optional)
    if (Math.random() < 0.1) { // 10% chance to run cleanup
      cleanupExpiredSessions().catch(console.error);
    }

    // Update last_login and ip_address
    await db.collection('users').updateOne(
      { email: email.toLowerCase() },
      { 
        $set: { 
          last_login: new Date().toISOString(), 
          ip_address,
          last_user_agent: user_agent
        } 
      }
    );

    // Log successful login for security monitoring
    await db.collection('security_logs').insertOne({
      event: 'successful_login',
      user_id: user.user_id,
      email: user.email,
      ip_address,
      user_agent,
      timestamp: new Date(),
      two_factor_used: !!user.two_factor_enabled
    });

    return NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
        is_superadmin: user.is_superadmin,
        account_status: user.account_status,
        two_factor_enabled: user.two_factor_enabled || false,
        force_2fa_enabled: user.force_2fa_enabled || false,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    
    // Handle MongoDB connection errors specifically
    if (err && typeof err === 'object') {
      const error = err as Error & { code?: string; name?: string };
      
      // Check for MongoDB connection errors
      if (error.code === 'EREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEOUT') {
        return NextResponse.json({ 
          success: false, 
          message: `Database connection failed (${error.code}). Please try again later.`,
          error_code: error.code
        }, { status: 503 });
      }
      
      // Check for other MongoDB-related errors
      if (error.name === 'MongoServerError' || error.name === 'MongoNetworkError' || error.message?.includes('mongodb')) {
        return NextResponse.json({ 
          success: false, 
          message: `Database error (${error.code || error.name}). Please try again later.`,
          error_code: error.code || error.name
        }, { status: 503 });
      }
    }
    
    // Generic server error for other types of errors
    return NextResponse.json({ 
      success: false, 
      message: 'Server error occurred. Please try again later.',
      error: String(err) 
    }, { status: 500 });
  }
}
