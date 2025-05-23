import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';
const client = new MongoClient(uri);

export async function POST(request: Request) {
  console.log('API /api/login called');
  try {
    const { email, password } = await request.json();
    console.log('Received login request for email:', email);
    await client.connect();
    // List all databases for debugging
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    console.log('Databases:', dbs.databases.map(db => db.name));
    // Try to use the correct DB name
    const db = client.db('polmatch');
    const collections = await db.listCollections().toArray();
    console.log('Collections in polmatch DB:', collections.map(c => c.name));
    // Only check the 'users' collection now
    let user = await db.collection('users').findOne({ email });
    console.log('User found in DB:', user ? JSON.stringify(user) : 'No user');
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ success: false, message: 'Invalid password' }, { status: 401 });
    }
    // Generate a session token
    const sessionToken = uuidv4();
    // Store session in DB (simple sessions collection)
    await db.collection('sessions').insertOne({
      sessionToken,
      user_id: user.user_id,
      createdAt: new Date(),
    });
    // Set session cookie (await cookies() for correct type)
    const cookieStore = await cookies();
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
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
