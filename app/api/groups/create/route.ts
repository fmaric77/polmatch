import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, Db } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import { 
  validateText, 
  validateRequestBody,
  createValidationErrorResponse,
  checkRateLimit,
  sanitizeText
} from '../../../../lib/validation';
import { validateSession } from '../../../../lib/auth';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

// Essential indexing function inlined to avoid import issues
async function ensureIndexes(db: Db, collectionName: string): Promise<void> {
  const coll = db.collection(collectionName);
  try {
    if (collectionName === 'groups') {
      await coll.createIndex({ group_id: 1 }, { unique: true, background: true });
      await coll.createIndex({ creator_id: 1, created_at: -1 }, { background: true });
    } else if (collectionName === 'group_members') {
      await coll.createIndex({ group_id: 1, user_id: 1 }, { unique: true, background: true });
      await coll.createIndex({ user_id: 1, joined_at: -1 }, { background: true });
    } else if (collectionName === 'group_channels') {
      await coll.createIndex({ group_id: 1, name: 1 }, { background: true });
      await coll.createIndex({ channel_id: 1 }, { unique: true, background: true });
    }
  } catch {
    // Index might already exist, which is fine
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(`create_group_${clientIP}`, 5, 60000)) {
      return createValidationErrorResponse('Too many group creation requests. Please try again later.', 429);
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

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return createValidationErrorResponse('Invalid JSON in request body', 400);
    }

    const bodyValidation = validateRequestBody(requestBody, ['name', 'description'], ['is_private', 'topic']);
    if (!bodyValidation.isValid) {
      return createValidationErrorResponse(bodyValidation.error!, 400);
    }

    const { name, description, is_private, topic } = requestBody;

    // Validate name
    const nameValidation = validateText(name, 'Group name', {
      required: true,
      minLength: 3,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9\s\-_.]+$/
    });
    if (!nameValidation.isValid) {
      return createValidationErrorResponse(nameValidation.error!, 400);
    }

    // Validate description
    const descriptionValidation = validateText(description, 'Description', {
      required: true,
      minLength: 10,
      maxLength: 500
    });
    if (!descriptionValidation.isValid) {
      return createValidationErrorResponse(descriptionValidation.error!, 400);
    }

    // Validate topic if provided
    if (topic !== undefined) {
      const topicValidation = validateText(topic, 'Topic', {
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\s\-_.]*$/
      });
      if (!topicValidation.isValid) {
        return createValidationErrorResponse(topicValidation.error!, 400);
      }
    }

    // Validate is_private if provided
    if (is_private !== undefined && typeof is_private !== 'boolean') {
      return createValidationErrorResponse('is_private must be a boolean', 400);
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('polmatch');

    // Create group with sanitized inputs
    const groupId = uuidv4();
    const now = new Date();
    
    const group = {
      group_id: groupId,
      name: sanitizeText(name),
      description: sanitizeText(description),
      creator_id: session.user_id,
      creation_date: now,
      is_private: is_private || false,
      members_count: 1,
      topic: topic ? sanitizeText(topic) : '',
      status: 'active',
      last_activity: now
    };

    // Ensure indexes exist before inserting
    await ensureIndexes(db, 'groups');
    await ensureIndexes(db, 'group_members');
    await ensureIndexes(db, 'group_channels');

    await db.collection('groups').insertOne(group);

    // Add creator as owner member
    const membership = {
      group_id: groupId,
      user_id: session.user_id,
      join_date: now,
      role: 'owner'
    };

    await db.collection('group_members').insertOne(membership);

    // Create default "general" channel for the group
    const defaultChannel = {
      channel_id: uuidv4(),
      group_id: groupId,
      name: 'general',
      description: 'General discussion',
      created_at: now,
      created_by: session.user_id,
      is_default: true,
      position: 0
    };

    await db.collection('group_channels').insertOne(defaultChannel);

    await client.close();

    return NextResponse.json({ 
      success: true, 
      group_id: groupId,
      default_channel_id: defaultChannel.channel_id,
      message: 'Group created successfully' 
    });

  } catch (error) {
    console.error('Error creating group:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
