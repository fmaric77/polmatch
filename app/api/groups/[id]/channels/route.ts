import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import MONGODB_URI from '../../../mongo-uri';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// Essential indexing function inlined to avoid import issues
async function ensureIndexes(db: any, collectionName: string): Promise<void> {
  const coll = db.collection(collectionName);
  try {
    if (collectionName === 'group_channels') {
      // Create a compound unique index for group_id + name to prevent duplicate channel names within a group
      await coll.createIndex({ group_id: 1, name: 1 }, { unique: true, background: true });
      // Create unique index for channel_id
      await coll.createIndex({ channel_id: 1 }, { unique: true, background: true });
      // Create index for sorting by position
      await coll.createIndex({ group_id: 1, position: 1 }, { background: true });
    }
  } catch (error: any) {
    // Index might already exist, which is fine
    console.log('Index creation note:', error.message);
  }
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET: List all channels in a group
export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
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

    const params = await context.params;
    const groupId = params.id;

    // Check if user is a member of the group
    const membership = await db.collection('group_members').findOne({
      group_id: groupId,
      user_id: session.user_id
    });

    if (!membership) {
      await client.close();
      return NextResponse.json({ 
        error: 'Not a member of this group' 
      }, { status: 403 });
    }

    // Get all channels in the group
    const channels = await db.collection('group_channels')
      .find({ group_id: groupId })
      .sort({ position: 1, created_at: 1 })
      .toArray();

    await client.close();

    return NextResponse.json({ 
      success: true, 
      channels 
    });

  } catch (error) {
    console.error('Error fetching channels:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// POST: Create a new channel in a group
export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
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

    const params = await context.params;
    const groupId = params.id;
    const { name, description } = await req.json();

    if (!name) {
      await client.close();
      return NextResponse.json({ 
        error: 'Channel name is required' 
      }, { status: 400 });
    }

    // Check if user is a member of the group with admin privileges
    const membership = await db.collection('group_members').findOne({
      group_id: groupId,
      user_id: session.user_id
    });

    if (!membership) {
      await client.close();
      return NextResponse.json({ 
        error: 'Not a member of this group' 
      }, { status: 403 });
    }

    // Only owners and admins can create channels
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      await client.close();
      return NextResponse.json({ 
        error: 'Insufficient permissions to create channels' 
      }, { status: 403 });
    }

    // Check if channel name already exists in this group (case-insensitive)
    const normalizedName = name.trim().toLowerCase();
    const existingChannel = await db.collection('group_channels').findOne({
      group_id: groupId,
      name: normalizedName
    });

    if (existingChannel) {
      await client.close();
      return NextResponse.json({ 
        error: 'Channel name already exists in this group' 
      }, { status: 409 });
    }

    // Get the highest position for ordering
    const lastChannel = await db.collection('group_channels')
      .findOne(
        { group_id: groupId },
        { sort: { position: -1 } }
      );

    const nextPosition = (lastChannel?.position || 0) + 1;

    // Create the channel
    const channelId = uuidv4();
    const channel = {
      channel_id: channelId,
      group_id: groupId,
      name: normalizedName,
      display_name: name.trim(), // Keep original case for display
      description: description || '',
      created_at: new Date(),
      created_by: session.user_id,
      is_default: false,
      position: nextPosition
    };

    // Ensure indexes exist before inserting
    await ensureIndexes(db, 'group_channels');

    try {
      await db.collection('group_channels').insertOne(channel);
      
      await client.close();

      return NextResponse.json({ 
        success: true, 
        channel_id: channelId,
        message: 'Channel created successfully' 
      });
      
    } catch (insertError: any) {
      await client.close();
      
      console.error('Channel insertion error:', insertError);
      
      // Handle duplicate key errors specifically
      if (insertError.code === 11000) {
        return NextResponse.json({ 
          error: 'Channel name already exists in this group' 
        }, { status: 409 });
      }
      
      // Re-throw other errors to be caught by outer catch
      throw insertError;
    }

  } catch (error) {
    console.error('Error creating channel:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
