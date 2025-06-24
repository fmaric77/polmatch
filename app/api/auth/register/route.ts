import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { connectToDatabase } from '../../../../lib/mongodb-connection';
import { 
  validateEmail, 
  validatePassword, 
  validateUsername,
  validateRequestBody,
  createValidationErrorResponse
} from '../../../../lib/validation';
import { createSession } from '../../../../lib/auth';

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

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return createValidationErrorResponse('Invalid JSON in request body', 400);
    }

    // Validate request structure
    const bodyValidation = validateRequestBody(body, ['email', 'username', 'password', 'confirmPassword'], []);
    if (!bodyValidation.isValid) {
      return createValidationErrorResponse(bodyValidation.error!, 400);
    }

    const { email, username, password, confirmPassword } = body;

    // Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return createValidationErrorResponse(emailValidation.error!, 400);
    }

    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      return createValidationErrorResponse(usernameValidation.error!, 400);
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return createValidationErrorResponse(passwordValidation.error!, 400);
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Get client information
    const ip_address = getClientIP(request);
    const user_agent = request.headers.get('user-agent') || 'unknown';

    const { db } = await connectToDatabase();

    // Check if IP is banned
    const ipBan = await db.collection('ban').findOne({ ip_address });
    if (ipBan) {
      return NextResponse.json(
        { success: false, message: 'Registration not allowed from this IP' },
        { status: 403 }
      );
    }

    // Check if email already exists
    const existingUser = await db.collection('users').findOne({ 
      email: email.toLowerCase() 
    });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Email already registered' },
        { status: 409 }
      );
    }

    // Check if username already exists
    const existingUsername = await db.collection('users').findOne({ 
      username: username.toLowerCase() 
    });
    if (existingUsername) {
      return NextResponse.json(
        { success: false, message: 'Username already taken' },
        { status: 409 }
      );
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate user ID
    const userId = uuidv4();

    // Create user document
    const newUser = {
      user_id: userId,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
      last_login: null,
      account_status: 'active',
      is_admin: false,
      is_superadmin: false,
      profile_picture: '',
      ip_address,
      password_updated_at: new Date()
    };

    // Insert user into database
    const insertResult = await db.collection('users').insertOne(newUser);
    if (!insertResult.acknowledged) {
      return NextResponse.json(
        { success: false, message: 'Failed to create user account' },
        { status: 500 }
      );
    }

    // Create session for automatic login
    const sessionToken = await createSession({
      user_id: userId,
      ip_address,
      user_agent
    });

    // Log successful registration
    await db.collection('security_logs').insertOne({
      user_id: userId,
      action: 'user_registration',
      timestamp: new Date(),
      ip_address,
      user_agent,
      details: {
        email: email.toLowerCase(),
        username: username.toLowerCase()
      }
    });

    // Set session cookie and return success
    const response = NextResponse.json(
      { 
        success: true, 
        message: 'Account created successfully',
        user: {
          user_id: userId,
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          is_admin: false,
          is_superadmin: false
        }
      },
      { status: 201 }
    );

    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('Registration API error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
