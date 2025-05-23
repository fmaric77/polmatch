import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../mongo-uri';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

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

    await db.collection('groups').insertOne(group);

    // Add creator as admin member
    const membership = {
      group_id: groupId,
      user_id: session.user_id,
      join_date: now,
      role: 'admin'
    };

    await db.collection('group_members').insertOne(membership);

    await client.close();

    return NextResponse.json({ 
      success: true, 
      group_id: groupId,
      message: 'Group created successfully' 
    });

  } catch (error) {
    console.error('Error creating group:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
