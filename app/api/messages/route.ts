import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { MongoClient, ObjectId } from 'mongodb';
import CryptoJS from 'crypto-js';

const uri = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';
const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

// GET: Fetch all threads for the logged-in user
export async function GET() {
  const client = new MongoClient(uri);
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await client.connect();
    const db = client.db('polmatch');
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    // Find all PMs where user is sender or receiver
    const pms = await db.collection('pm').find({ $or: [ { sender_id: user.user_id }, { receiver_id: user.user_id } ] }).sort({ timestamp: -1 }).toArray();
    // Decrypt message content before returning
    const decryptedPms = pms.map(msg => ({
      ...msg,
      content: (() => {
        try {
          const bytes = CryptoJS.AES.decrypt(msg.content, SECRET_KEY);
          return bytes.toString(CryptoJS.enc.Utf8) || '[Decryption failed]';
        } catch {
          return '[Decryption failed]';
        }
      })(),
    }));
    return NextResponse.json({ success: true, pms: decryptedPms });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}

// POST: Send a new message
export async function POST(request: Request) {
  const client = new MongoClient(uri);
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await client.connect();
    const db = client.db('polmatch');
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const { receiver_id, content, attachments } = body;
    if (!receiver_id || !content) return NextResponse.json({ success: false, message: 'Missing fields' }, { status: 400 });
    // Encrypt the message content before saving
    const encryptedContent = CryptoJS.AES.encrypt(content, SECRET_KEY).toString();
    const message = {
      sender_id: user.user_id,
      receiver_id,
      content: encryptedContent,
      timestamp: new Date().toISOString(),
      read: false,
      attachments: attachments || [],
    };
    await db.collection('pm').insertOne(message);
    return NextResponse.json({ success: true, message });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}

// PATCH: Mark messages as read
export async function PATCH(request: Request) {
  const client = new MongoClient(uri);
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await client.connect();
    const db = client.db('polmatch');
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const { sender_id } = body;
    if (!sender_id) return NextResponse.json({ success: false, message: 'Missing sender_id' }, { status: 400 });
    // Mark all messages from sender_id to this user as read
    await db.collection('pm').updateMany(
      { sender_id, receiver_id: user.user_id, read: false },
      { $set: { read: true } }
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}

// DELETE: Delete all messages in a chat for the logged-in user
export async function DELETE(request: Request) {
  const client = new MongoClient(uri);
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    await client.connect();
    const db = client.db('polmatch');
    const session = await db.collection('sessions').findOne({ sessionToken });
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    const body = await request.json();
    const { other_user_id } = body;
    if (!other_user_id) return NextResponse.json({ success: false, message: 'Missing other_user_id' }, { status: 400 });
    // Delete all messages where the logged-in user is either sender or receiver and the other user is the other participant
    const result = await db.collection('pm').deleteMany({
      $or: [
        { sender_id: user.user_id, receiver_id: other_user_id },
        { sender_id: other_user_id, receiver_id: user.user_id }
      ]
    });
    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  } finally {
    await client.close();
  }
}
