import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import CryptoJS from 'crypto-js';
import { getAuthenticatedUser, connectToDatabase } from '../../../lib/mongodb-connection';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY || 'default_secret_key';

interface ConversationDocument {
  _id: unknown;
  participant_ids: string[];
  profile_context?: string; // Format: "basic_love" for User A's basic profile talking to User B's love profile
  created_at: Date;
  updated_at: Date;
}

interface UserDocument {
  user_id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  profile_picture?: string;
  [key: string]: unknown;
}

interface MessageDocument {
  _id: unknown;
  conversation_id: unknown;
  content: string;
  encrypted_content?: string;
  sender_id: string;
  timestamp: Date;
  [key: string]: unknown;
}

interface LatestMessageAggregate {
  _id: unknown;
  latestMessage: MessageDocument;
}

// Helper function to get sorted participant IDs
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// Helper function to create profile context identifier
function getProfileContext(user1Profile: string, user2Profile: string, sortedParticipants: string[], user1Id: string): string {
  // For same-type conversations, always return the consistent format: "type_type"
  // This ensures consistent storage regardless of user order
  if (user1Profile === user2Profile) {
    return `${user1Profile}_${user2Profile}`;
  }
  
  // For different-type conversations (if ever implemented), maintain order consistency
  if (sortedParticipants[0] === user1Id) {
    return `${user1Profile}_${user2Profile}`;
  } else {
    return `${user2Profile}_${user1Profile}`;
  }
}

// GET: Fetch all private conversations for the current user
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { db } = await connectToDatabase();

    // Get optional profile type filter from query params
    const url = new URL(request.url);
    const userProfileType = url.searchParams.get('profile_type'); // e.g., 'basic', 'love', 'business'

    // Build query to filter conversations
    const conversationQuery: Record<string, unknown> = {
      participant_ids: auth.user.user_id
    };

    let privateConversations: unknown[] = [];

    // If profile type filter is provided, search in profile-specific collection
    if (userProfileType) {
      const profileCollectionName = `private_conversations_${userProfileType}`;
      
      // Create patterns to match conversations where user's profile type is involved
      const sameTypePattern = `${userProfileType}_${userProfileType}`;
      
      conversationQuery.$or = [
        { profile_context: sameTypePattern }, // New profile-specific conversations
        { profile_context: { $exists: false } }, // Legacy conversations without profile context
        { profile_context: null } // Conversations with null profile context
      ];
      
      // Get conversations from profile-specific collection
      privateConversations = await db.collection(profileCollectionName).find(conversationQuery)
        .sort({ updated_at: -1 }).toArray();
      
      console.log(`Found ${privateConversations.length} conversations in ${profileCollectionName} for profile type: ${userProfileType}`);
    } else {
      // Get conversations from all profile collections and main collection
      const collections = ['private_conversations', 'private_conversations_basic', 'private_conversations_love', 'private_conversations_business'];
      
      for (const collectionName of collections) {
        try {
          const conversations = await db.collection(collectionName).find(conversationQuery)
            .sort({ updated_at: -1 }).toArray();
          privateConversations.push(...conversations);
        } catch {
          // Collection might not exist, skip
          console.log(`Collection ${collectionName} not found or empty`);
        }
      }
      
      // Sort all conversations by updated_at
      (privateConversations as ConversationDocument[]).sort((a: ConversationDocument, b: ConversationDocument) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      
      console.log(`Found ${privateConversations.length} total conversations across all collections`);
      console.log('Conversation query:', JSON.stringify(conversationQuery, null, 2));
    }

    if (privateConversations.length === 0) {
      return NextResponse.json({ success: true, conversations: [] });
    }

    // Get the other participant IDs
    const otherUserIds = (privateConversations as ConversationDocument[]).map((conv: ConversationDocument) => {
      return conv.participant_ids.find((id: string) => id !== auth.user.user_id);
    }).filter(Boolean);

    // Get user details for other participants
    const otherUsers = await db.collection('users').find({
      user_id: { $in: otherUserIds }
    }).toArray();

    // Create a map for quick lookup
    const userMap = new Map((otherUsers as unknown as UserDocument[]).map((u: UserDocument) => [u.user_id, u]));

    // Get the latest message for each conversation from the appropriate message collections
    const messageMap = new Map<string, MessageDocument>();

    // Group conversations by their message collection
    const conversationsByCollection = new Map<string, unknown[]>();
    
    for (const conv of privateConversations as ConversationDocument[]) {
      let messageCollection = 'pm'; // Default legacy collection
      
      if (conv.profile_context) {
        const profileType = conv.profile_context.split('_')[0];
        if (['basic', 'love', 'business'].includes(profileType)) {
          messageCollection = `private_messages_${profileType}`;
        }
      }
      
      if (!conversationsByCollection.has(messageCollection)) {
        conversationsByCollection.set(messageCollection, []);
      }
      conversationsByCollection.get(messageCollection)!.push(conv._id);
    }

    // Fetch latest messages from each collection
    for (const [collectionName, convIds] of conversationsByCollection.entries()) {
      try {
        const latestMessages = await db.collection(collectionName).aggregate([
          { $match: { conversation_id: { $in: convIds } } },
          { $sort: { timestamp: -1 } },
          { $group: { 
            _id: '$conversation_id', 
            latestMessage: { $first: '$$ROOT' } 
          }}
        ]).toArray();

        // Add to message map
        for (const msgData of latestMessages as unknown as LatestMessageAggregate[]) {
          messageMap.set(msgData._id?.toString() || '', msgData.latestMessage);
        }
      } catch (error) {
        console.log(`Could not fetch messages from ${collectionName}:`, error);
      }
    }

    // Format the response
    const conversations = (privateConversations as unknown as ConversationDocument[]).map((conv: ConversationDocument) => {
      const otherUserId = conv.participant_ids.find((id: string) => id !== auth.user.user_id);
      const otherUser = otherUserId ? userMap.get(otherUserId) : null;
      const latestMessage = messageMap.get(conv._id?.toString() ?? '');
      
      // Parse profile context - no longer adding text-based suffix since UI now uses symbols
      // Profile context is still parsed for other purposes but no longer used for display names
      
      // Decrypt latest message content if it exists
      let decryptedLatestMessage = null;
      if (latestMessage) {
        try {
          // Handle both encrypted_content (profile messages) and content (legacy messages)
          const contentToDecrypt = (latestMessage as MessageDocument & { encrypted_content?: string }).encrypted_content || latestMessage.content;
          if (contentToDecrypt && typeof contentToDecrypt === 'string') {
            const bytes = CryptoJS.AES.decrypt(contentToDecrypt, SECRET_KEY);
            const decryptedContent = bytes.toString(CryptoJS.enc.Utf8) || '[Decryption failed]';
            decryptedLatestMessage = {
              ...latestMessage,
              content: decryptedContent
            };
            // Remove encrypted_content if it exists
            if ('encrypted_content' in decryptedLatestMessage) {
              delete (decryptedLatestMessage as MessageDocument & { encrypted_content?: string }).encrypted_content;
            }
          } else {
            // If no content to decrypt, use as-is
            decryptedLatestMessage = latestMessage;
          }
        } catch {
          decryptedLatestMessage = {
            ...latestMessage,
            content: '[Decryption failed]'
          };
          // Remove encrypted_content if it exists
          if ('encrypted_content' in decryptedLatestMessage) {
            delete (decryptedLatestMessage as MessageDocument & { encrypted_content?: string }).encrypted_content;
          }
        }
      }
      
      return {
        id: conv._id,
        participant_ids: conv.participant_ids,
        profile_context: conv.profile_context,
        other_user: otherUser ? {
          user_id: otherUser.user_id,
          username: otherUser.username,
          first_name: otherUser.first_name,
          last_name: otherUser.last_name,
          profile_picture: otherUser.profile_picture
        } : null,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        latest_message: decryptedLatestMessage
      };
    }).filter(conv => conv.other_user !== null); // Filter out conversations where other user doesn't exist

    return NextResponse.json({ success: true, conversations });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  }
}

// POST: Create a private conversation (used when starting a new conversation from search)
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { db } = await connectToDatabase();

    const body = await request.json();
    const { other_user_id, sender_profile_type = 'basic', receiver_profile_type = 'basic' } = body;
    
    console.log('Creating conversation with profile types:', {
      sender_profile_type,
      receiver_profile_type,
      other_user_id,
      current_user_id: auth.user.user_id
    });
    
    if (!other_user_id) {
      return NextResponse.json({ success: false, message: 'Missing other_user_id' }, { status: 400 });
    }

    // Verify the other user exists
    const otherUser = await db.collection('users').findOne({ user_id: other_user_id });
    if (!otherUser) {
      return NextResponse.json({ success: false, message: 'Other user not found' }, { status: 404 });
    }

    const now = new Date();
    const sortedParticipants = getSortedParticipants(auth.user.user_id, other_user_id);
    const profileContext = getProfileContext(sender_profile_type, receiver_profile_type, sortedParticipants, auth.user.user_id);

    console.log('Profile context calculation:', {
      sortedParticipants,
      sender_profile_type,
      receiver_profile_type,
      auth_user_id: auth.user.user_id,
      calculated_profile_context: profileContext
    });

    // Determine which collection to use based on profile context
    let conversationCollectionName = 'private_conversations';
    const profileType = profileContext.split('_')[0];
    if (['basic', 'love', 'business'].includes(profileType)) {
      conversationCollectionName = `private_conversations_${profileType}`;
    }

    console.log('Using conversation collection:', conversationCollectionName, 'for profile context:', profileContext);

    // Find or create the private conversation document with profile context
    let privateConversation = await db.collection(conversationCollectionName).findOne({
      participant_ids: sortedParticipants,
      profile_context: profileContext
    });

    if (!privateConversation) {
      // Create new private conversation with profile context
      const newConversation = {
        participant_ids: sortedParticipants,
        profile_context: profileContext,
        created_at: now,
        updated_at: now
      };
      const insertResult = await db.collection(conversationCollectionName).insertOne(newConversation);
      privateConversation = { _id: insertResult.insertedId, ...newConversation };
    } else {
      // Update existing conversation's timestamp
      await db.collection(conversationCollectionName).updateOne(
        { _id: privateConversation._id },
        { $set: { updated_at: now } }
      );
    }

    return NextResponse.json({ 
      success: true, 
      private_conversation_id: privateConversation._id,
      conversation: privateConversation
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  }
}

// PATCH: Update conversation metadata (e.g., when new messages are sent)
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { db } = await connectToDatabase();

    const body = await request.json();
    const { other_user_id, sender_profile_type, receiver_profile_type } = body;
    
    if (!other_user_id) {
      return NextResponse.json({ success: false, message: 'Missing other_user_id' }, { status: 400 });
    }

    const now = new Date();
    const sortedParticipants = getSortedParticipants(auth.user.user_id, other_user_id);

    // Determine which collection to use based on profile context
    let conversationCollectionName = 'private_conversations';
    let profileContext;
    
    if (sender_profile_type && receiver_profile_type) {
      profileContext = getProfileContext(sender_profile_type, receiver_profile_type, sortedParticipants, auth.user.user_id);
      const profileType = profileContext.split('_')[0];
      if (['basic', 'love', 'business'].includes(profileType)) {
        conversationCollectionName = `private_conversations_${profileType}`;
      }
    }

    // Update private conversation timestamp
    const updateQuery: Record<string, unknown> = { participant_ids: sortedParticipants };
    if (profileContext) {
      updateQuery.profile_context = profileContext;
    }

    const result = await db.collection(conversationCollectionName).updateOne(
      updateQuery,
      { $set: { updated_at: now } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  }
}

// DELETE: Delete entire conversation with profile-specific collection support
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const { db } = await connectToDatabase();

    const body = await request.json();
    const { other_user_id, sender_profile_type, receiver_profile_type } = body;
    
    if (!other_user_id) {
      return NextResponse.json({ success: false, message: 'Missing other_user_id' }, { status: 400 });
    }

    const sortedParticipants = getSortedParticipants(auth.user.user_id, other_user_id);
    
    let totalDeletedMessages = 0;
    let totalDeletedConversations = 0;

    // If profile types are provided, delete from profile-specific collections
    if (sender_profile_type && receiver_profile_type) {
      const profileContext = getProfileContext(sender_profile_type, receiver_profile_type, sortedParticipants, auth.user.user_id);
      const profileType = profileContext.split('_')[0];
      const messagesCollection = ['basic', 'love', 'business'].includes(profileType) ? `private_messages_${profileType}` : 'pm';
      const conversationCollection = ['basic', 'love', 'business'].includes(profileType) ? `private_conversations_${profileType}` : 'private_conversations';
      
      console.log(`🗑️ PROFILE DELETE - Profile Context: ${profileContext}, Messages Collection: ${messagesCollection}, Conversation Collection: ${conversationCollection}`);
      
      // Delete from profile-specific collections
      const profileDeleteQuery = {
        participant_ids: sortedParticipants,
        profile_context: profileContext
      };
      
      const [profileMessagesResult, profileConversationResult] = await Promise.all([
        // Delete messages from the messages collection
        db.collection(messagesCollection).deleteMany(profileDeleteQuery),
        // Delete conversation metadata from the conversation collection
        db.collection(conversationCollection).deleteOne({ participant_ids: sortedParticipants, profile_context: profileContext })
      ]);
      
      totalDeletedMessages = profileMessagesResult.deletedCount;
      totalDeletedConversations = profileConversationResult.deletedCount;
      
      console.log(`✅ Profile-specific deletion completed: ${profileMessagesResult.deletedCount} messages, ${profileConversationResult.deletedCount} conversations from ${profileType} collections`);
    } else {
      // Fallback: delete from all profile-specific collections for this user pair
      console.log('🗑️ COMPREHENSIVE DELETE - No profile types provided, deleting from all collections');
      
      const collections = [
        { messages: 'private_messages_basic', conversations: 'private_conversations_basic' },
        { messages: 'private_messages_love', conversations: 'private_conversations_love' },
        { messages: 'private_messages_business', conversations: 'private_conversations_business' },
        { messages: 'pm', conversations: 'private_conversations' } // Legacy collections
      ];
      
      for (const { messages: messagesCol, conversations: conversationsCol } of collections) {
        try {
          const [messagesResult, conversationResult] = await Promise.all([
            db.collection(messagesCol).deleteMany({ participant_ids: sortedParticipants }),
            db.collection(conversationsCol).deleteMany({ participant_ids: sortedParticipants })
          ]);
          
          totalDeletedMessages += messagesResult.deletedCount;
          totalDeletedConversations += conversationResult.deletedCount;
          
          if (messagesResult.deletedCount > 0 || conversationResult.deletedCount > 0) {
            console.log(`📦 Deleted from ${messagesCol}: ${messagesResult.deletedCount} messages, ${conversationResult.deletedCount} conversations`);
          }
        } catch {
          // Collection might not exist, continue with others
          console.log(`⚠️  Could not access ${messagesCol}/${conversationsCol}, continuing...`);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      deletedMessages: totalDeletedMessages,
      deletedConversations: totalDeletedConversations,
      type: 'conversation'
    });
  } catch (err: unknown) {
    console.error('Private conversations DELETE error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) });
  }
}
