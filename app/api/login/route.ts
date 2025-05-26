import { NextResponse } from 'next/server';
import { Db } from 'mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { connectToDatabase } from '../../../lib/mongodb-connection';

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
    const body = await request.json();
    const { email, password } = body;

    // Input validation
    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required' }, { status: 400 });
    }

    // Get client information
    const ip_address = getClientIP(request);
    const user_agent = request.headers.get('user-agent') || 'unknown';

    const { db } = await connectToDatabase();

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

    // Successful login - clear any failed attempts
    await clearFailedAttempts(db, email, ip_address);

    // Create a session
    const sessionToken = uuidv4();
    await db.collection('sessions').insertOne({ 
      sessionToken, 
      user_id: user.user_id,
      created_at: new Date(),
      ip_address,
      user_agent
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
      timestamp: new Date()
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
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  }
}
