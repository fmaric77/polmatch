import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import MONGODB_URI from '../../mongo-uri';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  // Auth check
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('polmatch');
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    // Admin check
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user || !user.is_admin) {
      return NextResponse.json({ success: false, message: 'Admin only' }, { status: 403 });
    }
    const { username, email, password, is_admin } = await request.json();
    if (!username || !email || !password) {
      return NextResponse.json({ success: false, message: 'All fields are required.' }, { status: 400 });
    }
    // Check if user already exists
    const existing = await db.collection('users').findOne({ email });
    if (existing) {
      await client.close();
      return NextResponse.json({ success: false, message: 'User with this email already exists.' }, { status: 409 });
    }
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    // Generate a user_id (UUID)
    const user_id = uuidv4();
    const now = new Date().toISOString();
    await db.collection('users').insertOne({
      user_id,
      username,
      email,
      password_hash,
      registration_date: now,
      last_login: now,
      account_status: 'active',
      ip_address: '',
      is_admin: !!is_admin,
      created_groups: [],
      joined_groups: [],
      profile_basic_id: uuidv4(),
      profile_business_id: uuidv4(),
      profile_love_id: uuidv4(),
      bookmarked_users: [],
      bookmarked_groups: [],
      bookmarked_jobs: []
    });
    await client.close();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) }, { status: 500 });
  }
}
