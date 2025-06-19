import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { cookies } from 'next/headers';
import MONGODB_URI from '../../mongo-uri';
import { 
  validateUserId, 
  validateRequestBody,
  createValidationErrorResponse,
  checkRateLimit
} from '../../../../lib/validation';
import { validateSession } from '../../../../lib/auth';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

const client = new MongoClient(MONGODB_URI);

// POST: Send a friend request
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(`friend_request_${clientIP}`, 20, 60000)) {
      return createValidationErrorResponse('Too many friend requests. Please try again later.', 429);
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return createValidationErrorResponse('Unauthorized', 401);
    }

    // Validate session using new utility
    const sessionResult = await validateSession(sessionToken);
    if (!sessionResult.valid || !sessionResult.session) {
      return createValidationErrorResponse('Invalid or expired session', 401);
    }
    const user_id = sessionResult.session.user_id;

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return createValidationErrorResponse('Invalid JSON in request body', 400);
    }

    const bodyValidation = validateRequestBody(requestBody, ['friend_id'], []);
    if (!bodyValidation.isValid) {
      return createValidationErrorResponse(bodyValidation.error!, 400);
    }

    const { friend_id } = requestBody;

    // Validate friend_id
    const friendIdValidation = validateUserId(friend_id);
    if (!friendIdValidation.isValid) {
      return createValidationErrorResponse(friendIdValidation.error!, 400);
    }

    await client.connect();
    const db = client.db('polmatch');

    // Prevent self-friending
    if (friend_id === user_id) {
      return createValidationErrorResponse('Cannot send friend request to yourself', 400);
    }

    // Verify target user exists
    const targetUser = await db.collection('users').findOne({ user_id: friend_id });
    if (!targetUser) {
      return createValidationErrorResponse('User not found', 404);
    }
    // Check if already friends or pending
    const existing = await db.collection('friends').findOne({
      $or: [
        { user_id, friend_id },
        { user_id: friend_id, friend_id: user_id }
      ]
    });
    if (existing) {
      return NextResponse.json({ success: false, message: 'Already friends or request pending' }, { status: 400 });
    }
    await db.collection('friends').insertOne({ user_id, friend_id, status: 'pending', created_at: new Date() });
    return NextResponse.json({ success: true, message: 'Friend request sent' });
  } catch (err) {
    return NextResponse.json({ success: false, message: 'Failed to send request', error: String(err) });
  } finally {
    // Do not close the client to keep pool open
  }
}
