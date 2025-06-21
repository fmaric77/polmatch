import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, Db } from 'mongodb';
import MONGODB_URI from '../../../mongo-uri';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

// Essential indexing function inlined to avoid import issues

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined');
}

async function ensureIndexes(db: Db, collectionName: string): Promise<void> {
  const coll = db.collection(collectionName);
  try {
    if (collectionName === 'group_channels' || collectionName.startsWith('group_channels_')) {
      // Create a compound unique index for group_id + name to prevent duplicate channel names within a group
      await coll.createIndex({ group_id: 1, name: 1 }, { unique: true, background: true });
      // Create unique index for channel_id
      await coll.createIndex({ channel_id: 1 }, { unique: true, background: true });
      // Create index for sorting by position
      await coll.createIndex({ group_id: 1, position: 1 }, { background: true });
    }
  } catch (error: unknown) {
    // Index might already exist, which is fine
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log('Index creation note:', errorMessage);
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

    // Get profile_type from query parameters
    const url = new URL(req.url);
    const profile_type = url.searchParams.get('profile_type') || 'basic';

    // Validate profile_type
    if (!['basic', 'love', 'business'].includes(profile_type)) {
      await client.close();
      return NextResponse.json({ 
        error: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    // Use profile-specific collections
    const membersCollection = profile_type === 'basic' ? 'group_members' : `group_members_${profile_type}`;
    const channelsCollection = profile_type === 'basic' ? 'group_channels' : `group_channels_${profile_type}`;

    // Check if user is a member of the group
    const membership = await db.collection(membersCollection).findOne({
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
    const channels = await db.collection(channelsCollection)
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
    const { name, description, profile_type } = await req.json();

    if (!name) {
      await client.close();
      return NextResponse.json({ 
        error: 'Channel name is required' 
      }, { status: 400 });
    }

    // Default to basic if not specified, validate profile_type
    const channelProfileType = profile_type || 'basic';
    if (!['basic', 'love', 'business'].includes(channelProfileType)) {
      await client.close();
      return NextResponse.json({ 
        error: 'Invalid profile_type. Must be basic, love, or business' 
      }, { status: 400 });
    }

    // Use profile-specific collections
    const membersCollection = channelProfileType === 'basic' ? 'group_members' : `group_members_${channelProfileType}`;
    const channelsCollection = channelProfileType === 'basic' ? 'group_channels' : `group_channels_${channelProfileType}`;

    // Check if user is a member of the group with admin privileges
    const membership = await db.collection(membersCollection).findOne({
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
    const existingChannel = await db.collection(channelsCollection).findOne({
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
    const lastChannel = await db.collection(channelsCollection)
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
    await ensureIndexes(db, channelsCollection);

    try {
      await db.collection(channelsCollection).insertOne(channel);
      
      await client.close();

      return NextResponse.json({ 
        success: true, 
        channel_id: channelId,
        message: 'Channel created successfully' 
      });
      
    } catch (insertError: unknown) {
      await client.close();
      
      console.error('Channel insertion error:', insertError);
      
      // Handle duplicate key errors specifically
      if (insertError && typeof insertError === 'object' && 'code' in insertError && insertError.code === 11000) {
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
