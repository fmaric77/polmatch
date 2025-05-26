import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// Essential indexing function inlined to avoid import issues
async function ensureIndexes(db: any, collectionName: string): Promise<void> {
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
  } catch (error) {
    // Index might already exist, which is fine
  }
}

export async function POST(req: NextRequest) {
  try {
    // Validate session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('polmatch');

    // Verify session
    const session = await db.collection('sessions').findOne({ 
      sessionToken: sessionToken 
    });
    
    if (!session) {
      await client.close();
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { name, description, is_private, topic } = await req.json();

    if (!name || !description) {
      await client.close();
      return NextResponse.json({ 
        error: 'Name and description are required' 
      }, { status: 400 });
    }

    // Create group
    const groupId = uuidv4();
    const now = new Date();
    
    const group = {
      group_id: groupId,
      name,
      description,
      creator_id: session.user_id,
      creation_date: now,
      is_private: is_private || false,
      members_count: 1,
      topic: topic || '',
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
