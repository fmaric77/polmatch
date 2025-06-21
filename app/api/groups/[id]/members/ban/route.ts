import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../../mongo-uri';
import { cookies } from 'next/headers';
import { 
  validateGroupId, 
  validateUserId, 
  validateText, 
  validateRequestBody,
  createValidationErrorResponse,
  checkRateLimit
} from '../../../../../../lib/validation';
import { validateSession } from '../../../../../../lib/auth';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(`ban_${clientIP}`, 10, 60000)) {
      return createValidationErrorResponse('Too many ban requests. Please try again later.', 429);
    }

    // Validate session
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
    const session = sessionResult.session;

    // Validate route parameters
    const params = await context.params;
    const groupIdValidation = validateGroupId(params.id);
    if (!groupIdValidation.isValid) {
      return createValidationErrorResponse(groupIdValidation.error!, 400);
    }
    const groupId = params.id;

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return createValidationErrorResponse('Invalid JSON in request body', 400);
    }

    const bodyValidation = validateRequestBody(requestBody, ['user_id'], ['reason', 'profile_type']);
    if (!bodyValidation.isValid) {
      return createValidationErrorResponse(bodyValidation.error!, 400);
    }

    const { user_id, reason, profile_type } = requestBody;

    // Default to basic if not specified, validate profile_type
    const groupProfileType = profile_type || 'basic';
    if (!['basic', 'love', 'business'].includes(groupProfileType)) {
      return createValidationErrorResponse('Invalid profile_type. Must be basic, love, or business', 400);
    }

    // Use profile-specific collections
    const membersCollection = groupProfileType === 'basic' ? 'group_members' : `group_members_${groupProfileType}`;
    const groupsCollection = groupProfileType === 'basic' ? 'groups' : `groups_${groupProfileType}`;
    const bansCollection = groupProfileType === 'basic' ? 'group_bans' : `group_bans_${groupProfileType}`;

    // Validate user_id
    const userIdValidation = validateUserId(user_id);
    if (!userIdValidation.isValid) {
      return createValidationErrorResponse(userIdValidation.error!, 400);
    }

    // Validate reason if provided
    if (reason !== undefined) {
      const reasonValidation = validateText(reason, 'Reason', { 
        maxLength: 500,
        pattern: /^[a-zA-Z0-9\s.,!?-]*$/ // Allow basic characters only
      });
      if (!reasonValidation.isValid) {
        return createValidationErrorResponse(reasonValidation.error!, 400);
      }
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('polmatch');

    // Verify session user exists
    const sessionUser = await db.collection('users').findOne({ user_id: session.user_id });
    if (!sessionUser) {
      await client.close();
      return createValidationErrorResponse('Session user not found', 401);
    }

    // Check if group exists
    const group = await db.collection(groupsCollection).findOne({ group_id: groupId });
    if (!group) {
      await client.close();
      return NextResponse.json({ 
        error: 'Group not found' 
      }, { status: 404 });
    }

    // Check if requester is admin/owner
    const requesterMembership = await db.collection(membersCollection).findOne({
      group_id: groupId,
      user_id: session.user_id
    });

    const isAdmin = group.creator_id === session.user_id || 
                   (requesterMembership && (requesterMembership.role === 'owner' || requesterMembership.role === 'admin'));

    if (!isAdmin) {
      await client.close();
      return NextResponse.json({ 
        error: 'Only group admins can ban members' 
      }, { status: 403 });
    }

    // Prevent banning the group creator
    if (group.creator_id === user_id) {
      await client.close();
      return NextResponse.json({ 
        error: 'Cannot ban the group creator' 
      }, { status: 400 });
    }

    // Check if user is already banned
    const existingBan = await db.collection(bansCollection).findOne({
      group_id: groupId,
      user_id: user_id
    });

    if (existingBan) {
      await client.close();
      return NextResponse.json({ 
        error: 'User is already banned from this group' 
      }, { status: 400 });
    }

    // Remove user from group if they are a member
    const targetMembership = await db.collection(membersCollection).findOne({
      group_id: groupId,
      user_id: user_id
    });

    if (targetMembership) {
      await db.collection(membersCollection).deleteOne({
        group_id: groupId,
        user_id: user_id
      });

      // Update group member count
      await db.collection(groupsCollection).updateOne(
        { group_id: groupId },
        { 
          $inc: { members_count: -1 },
          $set: { last_activity: new Date() }
        }
      );
    }

    // Add ban record
    await db.collection(bansCollection).insertOne({
      group_id: groupId,
      user_id: user_id,
      banned_by: session.user_id,
      banned_at: new Date(),
      reason: reason || 'No reason provided',
      profile_type: groupProfileType
    });

    await client.close();

    return NextResponse.json({ 
      success: true, 
      message: 'User banned successfully' 
    });

  } catch (error) {
    console.error('Error banning user:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
