// Database indexing utility for ensuring optimal performance
import { Db } from 'mongodb';

interface IndexDefinition {
  collection: string;
  indexes: Array<{
    fields: Record<string, 1 | -1 | 'text'>;
    options?: {
      unique?: boolean;
      sparse?: boolean;
      background?: boolean;
      name?: string;
    };
  }>;
}

// Comprehensive index definitions for all collections
const INDEX_DEFINITIONS: IndexDefinition[] = [
  // Private messages indexes
  {
    collection: 'pm',
    indexes: [
      { fields: { conversation_id: 1, timestamp: 1 } }, // Primary query pattern
      { fields: { sender_id: 1, timestamp: -1 } }, // Sender queries
      { fields: { receiver_id: 1, timestamp: -1 } }, // Receiver queries
      { fields: { timestamp: -1 } }, // Global recent messages
      { fields: { conversation_id: 1, read: 1 } }, // Unread message queries
    ]
  },

  // Private conversations indexes
  {
    collection: 'private_conversations',
    indexes: [
      { fields: { participant_ids: 1 }, options: { unique: true } }, // Unique conversation lookup
      { fields: { updated_at: -1 } }, // Recent activity sorting
      { fields: { created_at: -1 } }, // Creation time sorting
    ]
  },

  // Group messages indexes
  {
    collection: 'group_messages',
    indexes: [
      { fields: { group_id: 1, timestamp: 1 } }, // Group message history
      { fields: { group_id: 1, channel_id: 1, timestamp: 1 } }, // Channel-specific messages
      { fields: { message_id: 1 }, options: { unique: true } }, // Unique message lookup
      { fields: { sender_id: 1, timestamp: -1 } }, // Sender queries
      { fields: { timestamp: -1 } }, // Global recent messages
      { fields: { group_id: 1, sender_id: 1 } }, // Group member activity
    ]
  },

  // Group message reads indexes
  {
    collection: 'group_message_reads',
    indexes: [
      { fields: { message_id: 1, user_id: 1 }, options: { unique: true } }, // Prevent duplicate reads
      { fields: { message_id: 1 } }, // Message read status
      { fields: { user_id: 1, read_at: -1 } }, // User read history
      { fields: { group_id: 1, user_id: 1 } }, // Group read status per user
    ]
  },

  // Group channels indexes
  {
    collection: 'group_channels',
    indexes: [
      { fields: { group_id: 1, name: 1 }, options: { unique: true } }, // Unique channel names per group
      { fields: { group_id: 1, position: 1 } }, // Channel ordering
      { fields: { channel_id: 1 }, options: { unique: true } }, // Unique channel lookup
      { fields: { group_id: 1, is_default: 1 } }, // Default channel lookup
      { fields: { created_at: -1 } }, // Creation time sorting
    ]
  },

  // Groups indexes
  {
    collection: 'groups',
    indexes: [
      { fields: { group_id: 1 }, options: { unique: true } }, // Unique group lookup
      { fields: { creator_id: 1, created_at: -1 } }, // Creator's groups
      { fields: { is_private: 1, created_at: -1 } }, // Public/private group queries
      { fields: { last_activity: -1 } }, // Recent activity sorting
      { fields: { name: 'text', description: 'text' } }, // Text search
    ]
  },

  // Group members indexes
  {
    collection: 'group_members',
    indexes: [
      { fields: { group_id: 1, user_id: 1 }, options: { unique: true } }, // Unique membership
      { fields: { user_id: 1, joined_at: -1 } }, // User's group memberships
      { fields: { group_id: 1, role: 1 } }, // Role-based queries
      { fields: { group_id: 1, joined_at: 1 } }, // Member join order
    ]
  },

  // Group invitations indexes
  {
    collection: 'group_invitations',
    indexes: [
      { fields: { group_id: 1, invited_user_id: 1 }, options: { unique: true } }, // Unique invitations
      { fields: { invited_user_id: 1, status: 1 } }, // User's pending invitations
      { fields: { inviter_id: 1, created_at: -1 } }, // Inviter's sent invitations
      { fields: { status: 1, created_at: -1 } }, // Status-based queries
    ]
  },

  // Users indexes
  {
    collection: 'users',
    indexes: [
      { fields: { user_id: 1 }, options: { unique: true } }, // Unique user lookup
      { fields: { email: 1 }, options: { unique: true } }, // Email lookup
      { fields: { username: 1 }, options: { unique: true } }, // Username lookup
      { fields: { created_at: -1 } }, // Registration order
      { fields: { is_banned: 1, created_at: -1 } }, // Active users
    ]
  },

  // Sessions indexes
  {
    collection: 'sessions',
    indexes: [
      { fields: { sessionToken: 1 }, options: { unique: true } }, // Session lookup
      { fields: { user_id: 1, expires: -1 } }, // User's active sessions
      { fields: { expires: 1 } }, // Expired session cleanup
    ]
  },

  // Conversation states indexes (if using the conversation states feature)
  {
    collection: 'conversation_states',
    indexes: [
      { fields: { user_id: 1, other_user_id: 1, conversation_type: 1 }, options: { unique: true } },
      { fields: { user_id: 1, state: 1, last_message_at: -1 } },
      { fields: { conversation_id: 1 } },
    ]
  }
];

/**
 * Ensures all required indexes exist for a database
 * @param db MongoDB database instance
 * @param forceRecreate Whether to drop and recreate existing indexes
 */
export async function ensureIndexes(db: Db, forceRecreate: boolean = false): Promise<void> {
  console.log('🔧 Ensuring database indexes...');
  
  for (const { collection, indexes } of INDEX_DEFINITIONS) {
    console.log(`📊 Processing collection: ${collection}`);
    
    const coll = db.collection(collection);
    
    // Drop existing indexes if force recreate is enabled (except _id index)
    if (forceRecreate) {
      try {
        const existingIndexes = await coll.listIndexes().toArray();
        for (const index of existingIndexes) {
          if (index.name !== '_id_') {
            await coll.dropIndex(index.name);
            console.log(`  ❌ Dropped index: ${index.name}`);
          }
        }
      } catch (error) {
        console.log(`  ⚠️  Could not drop indexes for ${collection}: ${error}`);
      }
    }
    
    // Create new indexes
    for (const { fields, options } of indexes) {
      try {
        await coll.createIndex(fields, { ...options, background: true });
        const indexName = options?.name || Object.keys(fields).join('_');
        console.log(`  ✅ Created index: ${indexName}`);
      } catch (error) {
        console.log(`  ⚠️  Failed to create index on ${collection}:`, error);
      }
    }
  }
  
  console.log('✅ Database indexing completed');
}

/**
 * Ensures indexes for a specific collection when documents are created
 * @param db MongoDB database instance
 * @param collectionName Name of the collection
 */
export async function ensureCollectionIndexes(db: Db, collectionName: string): Promise<void> {
  const definition = INDEX_DEFINITIONS.find(def => def.collection === collectionName);
  
  if (!definition) {
    console.log(`⚠️  No index definition found for collection: ${collectionName}`);
    return;
  }
  
  const coll = db.collection(collectionName);
  
  for (const { fields, options } of definition.indexes) {
    try {
      await coll.createIndex(fields, { ...options, background: true });
    } catch (error) {
      // Index might already exist, which is fine
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('already exists')) {
        console.log(`⚠️  Failed to create index on ${collectionName}:`, error);
      }
    }
  }
}

/**
 * Gets index statistics for performance monitoring
 * @param db MongoDB database instance
 */
export async function getIndexStats(db: Db): Promise<Record<string, unknown>> {
  const stats: Record<string, unknown> = {};
  
  for (const { collection } of INDEX_DEFINITIONS) {
    try {
      const coll = db.collection(collection);
      const indexes = await coll.listIndexes().toArray();
      const indexStats = await coll.aggregate([
        { $indexStats: {} }
      ]).toArray();
      
      stats[collection] = {
        indexCount: indexes.length,
        indexes: indexes.map(idx => ({ name: idx.name, keys: idx.key })),
        usage: indexStats
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      stats[collection] = { error: errorMessage };
    }
  }
  
  return stats;
}

/**
 * Creates optimized aggregation pipeline for group messages with proper index usage
 * @param groupId Group ID to filter by
 * @param channelId Optional channel ID to filter by
 * @param userId Current user ID for read status
 * @param limit Number of messages to retrieve
 */
export function createGroupMessagesPipeline(
  groupId: string, 
  channelId?: string, 
  userId?: string, 
  limit: number = 50
): Record<string, unknown>[] {
  const pipeline: Record<string, unknown>[] = [
    // Match stage - uses group_id + channel_id index
    {
      $match: {
        group_id: groupId,
        ...(channelId && { channel_id: channelId })
      }
    },
    
    // Sort by timestamp (uses compound index)
    { $sort: { timestamp: -1 } },
    
    // Limit early to reduce processing
    { $limit: limit },
    
    // Lookup sender info
    {
      $lookup: {
        from: 'users',
        localField: 'sender_id',
        foreignField: 'user_id',
        as: 'sender',
        pipeline: [
          { $project: { username: 1, user_id: 1 } } // Only needed fields
        ]
      }
    },
    { $unwind: '$sender' },
  ];
  
  // Add read status lookup only if user ID is provided
  if (userId) {
    pipeline.push(
      {
        $lookup: {
          from: 'group_message_reads',
          let: { msgId: '$message_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$message_id', '$$msgId'] },
                    { $eq: ['$user_id', userId] }
                  ]
                }
              }
            }
          ],
          as: 'user_read'
        }
      },
      {
        $addFields: {
          current_user_read: { $gt: [{ $size: '$user_read' }, 0] }
        }
      }
    );
  }
  
  pipeline.push(
    // Final sort ascending for display
    { $sort: { timestamp: 1 } },
    
    // Project final fields
    {
      $project: {
        message_id: 1,
        group_id: 1,
        channel_id: 1,
        sender_id: 1,
        content: 1,
        timestamp: 1,
        attachments: 1,
        sender_username: '$sender.username',
        ...(userId && { current_user_read: 1 })
      }
    }
  );
  
  return pipeline;
}

/**
 * Creates optimized aggregation pipeline for private conversations
 * @param userId Current user ID
 * @param limit Number of conversations to retrieve
 */
export function createPrivateConversationsPipeline(userId: string, limit: number = 50): Record<string, unknown>[] {
  return [
    // Match conversations where user is a participant
    {
      $match: {
        participant_ids: userId
      }
    },
    
    // Sort by recent activity
    { $sort: { updated_at: -1 } },
    
    // Limit results
    { $limit: limit },
    
    // Get the other participant
    {
      $addFields: {
        other_user_id: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$participant_ids',
                cond: { $ne: ['$$this', userId] }
              }
            },
            0
          ]
        }
      }
    },
    
    // Lookup other user details
    {
      $lookup: {
        from: 'users',
        localField: 'other_user_id',
        foreignField: 'user_id',
        as: 'other_user',
        pipeline: [
          { $project: { username: 1, user_id: 1 } }
        ]
      }
    },
    { $unwind: '$other_user' },
    
    // Lookup latest message
    {
      $lookup: {
        from: 'pm',
        localField: '_id',
        foreignField: 'conversation_id',
        as: 'latest_message',
        pipeline: [
          { $sort: { timestamp: -1 } },
          { $limit: 1 },
          { $project: { content: 1, timestamp: 1, sender_id: 1 } }
        ]
      }
    },
    
    {
      $addFields: {
        latest_message: { $arrayElemAt: ['$latest_message', 0] }
      }
    },
    
    {
      $project: {
        _id: 1,
        participant_ids: 1,
        created_at: 1,
        updated_at: 1,
        other_user: 1,
        latest_message: 1
      }
    }
  ];
}
