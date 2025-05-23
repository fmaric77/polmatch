import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import MONGODB_URI from '../mongo-uri';

const client = new MongoClient(MONGODB_URI);

export async function POST(request: Request) {
  console.log('API /api/login called');
  try {
    const body = await request.json();
    const { email, password } = body;

    // Input validation
    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required' }, { status: 400 });
    }

    await client.connect();
    const db = client.db('polmatch');

    // Check if the user exists
    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid email or password' }, { status: 401 });
    }

    // Check if the password matches
    // Use user.password_hash instead of user.password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json({ success: false, message: 'Invalid email or password' }, { status: 401 });
    }

    // Create a session
    const sessionToken = uuidv4();
    await db.collection('sessions').insertOne({ sessionToken, user_id: user.user_id });

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set('session', sessionToken, { httpOnly: true, path: '/' });

    // Get IP address from request headers
    let ip_address = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || request.headers.get('remote-addr') || '';
    if (ip_address && ip_address.includes(',')) {
      ip_address = ip_address.split(',')[0].trim();
    }
    // Update last_login and ip_address
    await db.collection('users').updateOne(
      { email },
      { $set: { last_login: new Date().toISOString(), ip_address } }
    );

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
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}
