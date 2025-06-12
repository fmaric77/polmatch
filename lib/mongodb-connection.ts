import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

interface CachedConnection {
  client: MongoClient;
  db: Db;
}

let cachedConnection: CachedConnection | null = null;

export async function connectToDatabase(): Promise<CachedConnection> {
  if (cachedConnection) {
    return cachedConnection;
  }

  const client = new MongoClient(MONGODB_URI, {
    // Connection pooling options for performance
    maxPoolSize: 10, // Maintain up to 10 socket connections
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
    // Compression for faster data transfer
    compressors: ['snappy', 'zlib'],
  });

  await client.connect();
  const db = client.db('polmatch');

  cachedConnection = { client, db };
  return cachedConnection;
}

// Session and user caching
const sessionCache = new Map<string, { userId: string; timestamp: number }>();
const userCache = new Map<string, { data: UserDocument; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface UserDocument {
  user_id: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  profile_picture?: string;
  is_admin?: boolean;
  [key: string]: unknown;
}

export async function getAuthenticatedUser(sessionToken: string): Promise<{ user: UserDocument; userId: string } | null> {
  // Check session cache first
  const cachedSession = sessionCache.get(sessionToken);
  if (cachedSession && Date.now() - cachedSession.timestamp < CACHE_TTL) {
    const cachedUser = userCache.get(cachedSession.userId);
    if (cachedUser && Date.now() - cachedUser.timestamp < CACHE_TTL) {
      return { user: cachedUser.data, userId: cachedSession.userId };
    }
  }

  const { db } = await connectToDatabase();

  // Verify session
  const session = await db.collection('sessions').findOne({ sessionToken });
  if (!session) {
    return null;
  }

  // Get user data
  const user = await db.collection('users').findOne({ user_id: session.user_id });
  if (!user) {
    return null;
  }

  // Cache session and user data
  sessionCache.set(sessionToken, { userId: session.user_id, timestamp: Date.now() });
  userCache.set(session.user_id, { data: user as unknown as UserDocument, timestamp: Date.now() });

  return { user: user as unknown as UserDocument, userId: session.user_id };
}

// Optimized profile picture lookup using aggregation
export async function getProfilePicture(userId: string): Promise<string | null> {
  const { db } = await connectToDatabase();

  // Use aggregation to check all profile collections in one query
  const result = await db.collection('users').aggregate([
    { $match: { user_id: userId } },
    {
      $lookup: {
        from: 'basicprofiles',
        localField: 'user_id',
        foreignField: 'user_id',
        as: 'basicProfile'
      }
    },
    {
      $lookup: {
        from: 'loveprofiles',
        localField: 'user_id',
        foreignField: 'user_id',
        as: 'loveProfile'
      }
    },
    {
      $lookup: {
        from: 'businessprofiles',
        localField: 'user_id',
        foreignField: 'user_id',
        as: 'businessProfile'
      }
    },
    {
      $project: {
        profile_picture_url: {
          $cond: {
            if: { $gt: [{ $size: '$basicProfile' }, 0] },
            then: { $arrayElemAt: ['$basicProfile.profile_picture_url', 0] },
            else: {
              $cond: {
                if: { $gt: [{ $size: '$loveProfile' }, 0] },
                then: { $arrayElemAt: ['$loveProfile.profile_picture_url', 0] },
                else: { $arrayElemAt: ['$businessProfile.profile_picture_url', 0] }
              }
            }
          }
        }
      }
    }
  ]).toArray();

  return result[0]?.profile_picture_url || null;
}

// Optimized message retrieval for private conversations
export async function getPrivateMessages(userId1: string, userId2: string, limit: number = 50, profileContext?: string): Promise<unknown[]> {
  const { db } = await connectToDatabase();
  
  const sortedParticipants = [userId1, userId2].sort();
  
  const query: Record<string, unknown> = {
    participant_ids: { $all: sortedParticipants, $size: 2 }
  };
  
  // Add profile context if provided
  if (profileContext) {
    query.profile_context = profileContext;
  }
  
  return await db.collection('pm').find(query)
  .sort({ timestamp: -1 })
  .limit(limit)
  .project({
    message_id: 1,
    sender_id: 1,
    encrypted_content: 1,
    timestamp: 1,
    is_read: 1,
    profile_context: 1
  })
  .toArray();
}

// Optimized group messages retrieval
export async function getGroupMessages(groupId: string, channelId?: string, limit: number = 50): Promise<unknown[]> {
  const { db } = await connectToDatabase();
  
  const matchStage: Record<string, unknown> = { group_id: groupId };
  if (channelId) {
    matchStage.channel_id = channelId;
  }

  // OPTIMIZED: Use more efficient aggregation with better field projection
  return await db.collection('group_messages').aggregate([
    { $match: matchStage },
    { $sort: { timestamp: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: 'sender_id',
        foreignField: 'user_id',
        as: 'sender',
        pipeline: [{ $project: { user_id: 1, username: 1 } }]
      }
    },
    { $unwind: '$sender' },
    {
      $project: {
        message_id: 1,
        sender_id: 1,
        // Handle both field names - some messages use 'content', others use 'encrypted_content'
        content: { 
          $cond: { 
            if: { $ifNull: ['$content', false] }, 
            then: '$content', 
            else: '$encrypted_content' 
          } 
        },
        timestamp: 1,
        channel_id: 1,
        sender_username: '$sender.username'
      }
    },
    { $sort: { timestamp: 1 } } // Final sort for display order
  ]).toArray();
}

// Database health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();
    await db.admin().ping();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Ensure optimal indexes for performance
export async function ensureOptimalIndexes(): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    
    // Group messages indexes for fast channel switching
    await db.collection('group_messages').createIndex(
      { group_id: 1, channel_id: 1, timestamp: -1 },
      { background: true, name: 'group_channel_timestamp' }
    );
    
    await db.collection('group_messages').createIndex(
      { message_id: 1 },
      { unique: true, background: true, name: 'unique_message_id' }
    );
    
    // Group members index for membership checks
    await db.collection('group_members').createIndex(
      { group_id: 1, user_id: 1 },
      { background: true, name: 'group_user_membership' }
    );
    
    // Group channels index for channel validation
    await db.collection('group_channels').createIndex(
      { group_id: 1, channel_id: 1 },
      { background: true, name: 'group_channel_lookup' }
    );
    
    // Private messages indexes
    await db.collection('pm').createIndex(
      { participant_ids: 1, timestamp: -1 },
      { background: true, name: 'participants_timestamp' }
    );
    
    console.log('Optimal indexes ensured');
  } catch (error) {
    console.error('Error ensuring indexes:', error);
  }
}

// Cleanup function for graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  if (cachedConnection) {
    await cachedConnection.client.close();
    cachedConnection = null;
  }
}
