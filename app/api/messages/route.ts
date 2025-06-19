import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import CryptoJS from 'crypto-js';
import { ObjectId } from 'mongodb';
import { getAuthenticatedUser, connectToDatabase, getPrivateMessages } from '../../../lib/mongodb-connection';
import { notifyNewMessage, notifyNewConversation } from '../../../lib/sse-notifications';
import { 
  validateUserId, 
  validateProfileType, 
  validateText,
  validateRequestBody,
  createValidationErrorResponse,
  checkRateLimit,
  sanitizeText
} from '../../../lib/validation';

const SECRET_KEY = process.env.MESSAGE_SECRET_KEY;

if (!SECRET_KEY) {
  throw new Error('MESSAGE_SECRET_KEY environment variable is not defined');
}

// Type assertion since we've verified it's defined
const CRYPTO_SECRET = SECRET_KEY as string;

interface PrivateMessage {
  _id?: unknown;
  sender_id: string;
  receiver_id?: string;
  encrypted_content?: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachments: string[];
  [key: string]: unknown;
}

interface ConversationDocument {
  _id?: unknown;
  updated_at: string;
  lastMessage?: unknown;
  [key: string]: unknown;
}

// Helper function to get sorted participant IDs for consistent conversation lookup
function getSortedParticipants(userId1: string, userId2: string): string[] {
  return [userId1, userId2].sort();
}

// Helper function to create profile context identifier
function getProfileContext(user1Profile: string, user2Profile: string, sortedParticipants: string[], user1Id: string): string {
  // Determine which profile belongs to which participant based on sorted order
  if (sortedParticipants[0] === user1Id) {
    return `${user1Profile}_${user2Profile}`;
  } else {
    return `${user2Profile}_${user1Profile}`;
  }
}

// GET: Fetch messages for a specific conversation or all conversations for the user
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    // Fast authentication with caching
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    const url = new URL(request.url);
    const otherUserId = url.searchParams.get('other_user_id') || url.searchParams.get('user_id'); // Support both parameter names
    const lastCheck = url.searchParams.get('last_check');
    const countOnly = url.searchParams.get('count_only') === 'true';
    const senderProfileType = url.searchParams.get('sender_profile_type');
    const receiverProfileType = url.searchParams.get('receiver_profile_type');
    
    console.log(`📥 MESSAGE API REQUEST PARAMS:`);
    console.log(`  URL: ${request.url}`);
    console.log(`  Other User ID: ${otherUserId}`);
    console.log(`  Sender Profile Type: ${senderProfileType}`);
    console.log(`  Receiver Profile Type: ${receiverProfileType}`);
    console.log(`  Count Only: ${countOnly}`);
    console.log(`  Last Check: ${lastCheck}`);
    
    let pms;
    
    if (otherUserId) {
      // OPTIMIZATION: If count_only is true, just check if there are new messages
      if (countOnly && lastCheck) {
        const sortedParticipants = getSortedParticipants(auth.userId, otherUserId);
        
        let newMessageCount = 0;
        
        // Count messages based on profile context
        if (senderProfileType && receiverProfileType) {
          const profileContext = getProfileContext(senderProfileType, receiverProfileType, sortedParticipants, auth.userId);
          const profileType = profileContext.split('_')[0];
          const primaryCollection = ['basic', 'love', 'business'].includes(profileType) ? `private_messages_${profileType}` : 'pm';
          
          // Count profile-specific messages
          const profileQuery = {
            participant_ids: sortedParticipants,
            profile_context: profileContext,
            timestamp: { $gt: lastCheck }
          };
          
          const profileCount = await db.collection(primaryCollection).countDocuments(profileQuery);
          
          // Count legacy messages
          const legacyQuery = {
            participant_ids: sortedParticipants,
            timestamp: { $gt: lastCheck },
            $or: [
              { profile_context: { $exists: false } },
              { profile_context: null }
            ]
          };
          
          const legacyCount = await db.collection('pm').countDocuments(legacyQuery);
          newMessageCount = profileCount + legacyCount;
        } else {
          // Fallback for requests without profile context
          const query = { 
            participant_ids: sortedParticipants,
            timestamp: { $gt: lastCheck }
          };
          newMessageCount = await db.collection('pm').countDocuments(query);
        }
        
        return NextResponse.json({ 
          success: true, 
          has_new_messages: newMessageCount > 0,
          new_message_count: newMessageCount
        });
      }
      
      // Get messages for specific conversation using profile context if provided
      if (senderProfileType && receiverProfileType) {
        const sortedParticipants = getSortedParticipants(auth.userId, otherUserId);
        const profileContext = getProfileContext(senderProfileType, receiverProfileType, sortedParticipants, auth.userId);
        
        // Determine which collection to search based on profile context
        const profileType = profileContext.split('_')[0];
        const primaryCollection = ['basic', 'love', 'business'].includes(profileType) ? `private_messages_${profileType}` : 'pm';
        
        console.log(`🔍 MESSAGE RETRIEVAL DEBUG:`);
        console.log(`  Auth User ID: ${auth.userId}`);
        console.log(`  Other User ID: ${otherUserId}`);
        console.log(`  Sender Profile Type: ${senderProfileType}`);
        console.log(`  Receiver Profile Type: ${receiverProfileType}`);
        console.log(`  Sorted Participants: ${JSON.stringify(sortedParticipants)}`);
        console.log(`  Generated Profile Context: ${profileContext}`);
        console.log(`  Profile Type: ${profileType}`);
        console.log(`  Primary Collection: ${primaryCollection}`);
        
        // Search in profile-specific collection first
        const profileSpecificQuery = {
          participant_ids: sortedParticipants,
          profile_context: profileContext
        };
        
        console.log(`  Profile Query: ${JSON.stringify(profileSpecificQuery)}`);
        
        const profileMessages = await db.collection(primaryCollection).find(profileSpecificQuery)
          .sort({ timestamp: -1 })
          .limit(50)
          .toArray();
        
        console.log(`  Profile Messages Found: ${profileMessages.length}`);
        
        console.log(`  Profile Messages Found: ${profileMessages.length}`);
        
        // Also search for legacy messages in main 'pm' collection for backward compatibility
        const legacyQuery = {
          participant_ids: sortedParticipants,
          $or: [
            { profile_context: { $exists: false } }, // Legacy messages without profile context
            { profile_context: null } // Messages with null profile context
          ]
        };
        
        console.log(`  Legacy Query: ${JSON.stringify(legacyQuery)}`);
        
        const legacyMessages = await db.collection('pm').find(legacyQuery)
          .sort({ timestamp: -1 })
          .limit(50)
          .toArray();
        
        console.log(`  Legacy Messages Found: ${legacyMessages.length}`);
        
        // Combine and sort all messages by timestamp
        const allMessages = [...profileMessages, ...legacyMessages]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 50);
        
        console.log(`  Total Combined Messages: ${allMessages.length}`);
        
        console.log(`Found ${profileMessages.length} profile-specific messages and ${legacyMessages.length} legacy messages for ${senderProfileType}-${receiverProfileType} conversation between ${auth.userId} and ${otherUserId}`);
        
        // Decrypt messages
        for (const pm of allMessages as PrivateMessage[]) {
          try {
            const decryptedBytes = CryptoJS.AES.decrypt(pm.encrypted_content || pm.content, CRYPTO_SECRET);
            pm.content = decryptedBytes.toString(CryptoJS.enc.Utf8);
            delete pm.encrypted_content;
          } catch {
            pm.content = '[Decryption failed]';
            delete pm.encrypted_content;
          }
        }
        
        // Reverse to show oldest first
        allMessages.reverse();
        pms = allMessages;
      } else {
        // Get messages for specific conversation using optimized function (legacy support)
        pms = await getPrivateMessages(auth.userId, otherUserId, 50);
        
        // Decrypt messages
        for (const pm of pms as PrivateMessage[]) {
          try {
            const decryptedBytes = CryptoJS.AES.decrypt(pm.encrypted_content || pm.content, CRYPTO_SECRET);
            pm.content = decryptedBytes.toString(CryptoJS.enc.Utf8);
            delete pm.encrypted_content;
          } catch {
            pm.content = '[Decryption failed]';
            delete pm.encrypted_content;
          }
        }
        
        // Reverse to show oldest first
        pms.reverse();
      }
    } else {
      // Get all conversations for the user from profile-specific collections
      const conversationCollections = ['private_conversations_basic', 'private_conversations_love', 'private_conversations_business', 'private_conversations'];
      let allConversations: ConversationDocument[] = [];
      
      // Search across all conversation collections
      for (const collectionName of conversationCollections) {
        try {
          const conversations = await db.collection(collectionName).find({
            participant_ids: auth.userId
          }).sort({ updated_at: -1 }).toArray();
          
          // For each conversation, find the latest message from the corresponding message collection
          for (const conv of conversations) {
            let messageCollection = 'pm'; // Default fallback
            
            // Determine message collection based on profile context or collection name
            if (conv.profile_context) {
              const profileType = conv.profile_context.split('_')[0];
              if (['basic', 'love', 'business'].includes(profileType)) {
                messageCollection = `private_messages_${profileType}`; // Use separate message collections
              }
            } else if (collectionName.startsWith('private_conversations_')) {
              // For conversations without profile_context but in profile-specific collections
              const profileType = collectionName.replace('private_conversations_', '');
              if (['basic', 'love', 'business'].includes(profileType)) {
                messageCollection = `private_messages_${profileType}`;
              }
            }
            
            // Find latest message for this conversation
            const latestMessage = await db.collection(messageCollection).findOne(
              { participant_ids: conv.participant_ids },
              { sort: { timestamp: -1 } }
            );
            
            if (latestMessage) {
              // Decrypt the latest message
              try {
                const decryptedBytes = CryptoJS.AES.decrypt(latestMessage.encrypted_content || latestMessage.content, CRYPTO_SECRET);
                latestMessage.content = decryptedBytes.toString(CryptoJS.enc.Utf8);
                delete latestMessage.encrypted_content;
              } catch {
                latestMessage.content = '[Decryption failed]';
                delete latestMessage.encrypted_content;
              }
            }
            
            allConversations.push({
              ...conv,
              lastMessage: latestMessage
            } as ConversationDocument);
          }
        } catch (error) {
          // Collection might not exist, skip
          console.log(`Collection ${collectionName} not found or empty:`, error);
        }
      }
      
      // Sort all conversations by updated_at and limit to 20
      allConversations.sort((a: ConversationDocument, b: ConversationDocument) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      allConversations = allConversations.slice(0, 20);
      
      console.log(`Found ${allConversations.length} total conversations across all profile collections`);
      
      return NextResponse.json({ success: true, conversations: allConversations });
    }
    
    return NextResponse.json({ success: true, messages: pms });
  } catch (err) {
    console.error('Messages API error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) }, { status: 500 });
  }
}

// POST: Send a new message
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(`send_message_${clientIP}`, 60, 60000)) {
      return createValidationErrorResponse('Too many messages. Please try again later.', 429);
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return createValidationErrorResponse('Unauthorized', 401);
    }
    
    // Fast authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return createValidationErrorResponse('Unauthorized', 401);
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return createValidationErrorResponse('Invalid JSON in request body', 400);
    }

    const bodyValidation = validateRequestBody(body, ['receiver_id', 'content'], ['attachments', 'sender_profile_type', 'receiver_profile_type', 'reply_to']);
    if (!bodyValidation.isValid) {
      console.error('⚠️ /api/messages validation error:', bodyValidation.error);
      console.error('📋 Request body:', body);
      return createValidationErrorResponse(bodyValidation.error!, 400);
    }

    const { receiver_id, content, attachments, sender_profile_type, receiver_profile_type, reply_to } = body;

    console.log('📨 /api/messages POST request:', {
      receiver_id,
      content: content?.substring(0, 50) + '...',
      sender_profile_type,
      receiver_profile_type,
      has_reply_to: !!reply_to,
      auth_user: auth.userId
    });

    // Validate receiver_id
    const receiverIdValidation = validateUserId(receiver_id);
    if (!receiverIdValidation.isValid) {
      return createValidationErrorResponse(receiverIdValidation.error!, 400);
    }

    // Validate content
    const contentValidation = validateText(content, 'Message content', {
      required: true,
      minLength: 1,
      maxLength: 2000
    });
    if (!contentValidation.isValid) {
      return createValidationErrorResponse(contentValidation.error!, 400);
    }

    // Validate profile types if provided
    if (sender_profile_type) {
      const senderProfileValidation = validateProfileType(sender_profile_type);
      if (!senderProfileValidation.isValid) {
        return createValidationErrorResponse(senderProfileValidation.error!, 400);
      }
    }

    if (receiver_profile_type) {
      const receiverProfileValidation = validateProfileType(receiver_profile_type);
      if (!receiverProfileValidation.isValid) {
        return createValidationErrorResponse(receiverProfileValidation.error!, 400);
      }
    }

    // Validate attachments if provided
    if (attachments !== undefined) {
      if (!Array.isArray(attachments)) {
        return createValidationErrorResponse('Attachments must be an array', 400);
      }
      if (attachments.length > 5) {
        return createValidationErrorResponse('Maximum 5 attachments allowed', 400);
      }
    }

    // Validate reply_to if provided
    if (reply_to !== undefined) {
      if (typeof reply_to !== 'object' || reply_to === null) {
        return createValidationErrorResponse('reply_to must be an object', 400);
      }
      
      const requiredReplyFields = ['message_id', 'content', 'sender_name'];
      for (const field of requiredReplyFields) {
        if (!reply_to[field] || typeof reply_to[field] !== 'string') {
          return createValidationErrorResponse(`reply_to.${field} is required and must be a string`, 400);
        }
      }
      
      // Validate reply content length
      if (reply_to.content.length > 500) {
        return createValidationErrorResponse('reply_to.content too long (max 500 characters)', 400);
      }
    }

    // Prevent self-messaging
    if (receiver_id === auth.userId) {
      return createValidationErrorResponse('Cannot send message to yourself', 400);
    }

    const { db } = await connectToDatabase();
    
    // Verify receiver exists (with projection to only get user_id)
    const receiver = await db.collection('users').findOne(
      { user_id: receiver_id },
      { projection: { user_id: 1 } }
    );
    if (!receiver) {
      return NextResponse.json({ success: false, message: 'Receiver not found' }, { status: 404 });
    }
    
    const now = new Date();
    const sortedParticipants = getSortedParticipants(auth.userId, receiver_id);
    
    // Generate profile context if profile types are provided
    let profileContext: string | undefined;
    if (sender_profile_type && receiver_profile_type) {
      profileContext = getProfileContext(sender_profile_type, receiver_profile_type, sortedParticipants, auth.userId);
    }
    
    // Check if this is a new conversation
    const conversationQuery: Record<string, unknown> = { participant_ids: sortedParticipants };
    if (profileContext) {
      conversationQuery.profile_context = profileContext;
    }
    
    // Determine conversation collection based on profile context
    let conversationCollectionName = 'private_conversations';
    if (profileContext) {
      const profileType = profileContext.split('_')[0];
      if (['basic', 'love', 'business'].includes(profileType)) {
        conversationCollectionName = `private_conversations_${profileType}`;
      }
    }
    
    const existingConversation = await db.collection(conversationCollectionName).findOne(conversationQuery);
    const isNewConversation = !existingConversation;
    
    // Find or create private conversation using upsert
    const conversationSetOnInsert: Record<string, unknown> = {
      participant_ids: sortedParticipants, 
      created_at: now 
    };
    
    // Add profile context if provided
    if (profileContext) {
      conversationSetOnInsert.profile_context = profileContext;
    }
    
    const conversationResult = await db.collection(conversationCollectionName).findOneAndUpdate(
      conversationQuery,
      {
        $set: { updated_at: now },
        $setOnInsert: conversationSetOnInsert
      },
      { upsert: true, returnDocument: 'after' }
    );
    
    // Sanitize content before encryption
    const sanitizedContent = sanitizeText(content);
    
    // Encrypt the message content before saving
    const encryptedContent = CryptoJS.AES.encrypt(sanitizedContent, CRYPTO_SECRET).toString();
    const message: Record<string, unknown> = {
      participant_ids: sortedParticipants,
      sender_id: auth.userId,
      receiver_id,
      encrypted_content: encryptedContent,
      timestamp: now.toISOString(),
      is_read: false,
      attachments: attachments || [],
    };

    // Add reply_to information if provided
    if (reply_to) {
      message.reply_to = {
        message_id: reply_to.message_id,
        content: reply_to.content,
        sender_name: reply_to.sender_name
      };
    }
    
    // Determine which collection to use based on profile context
    let collectionName = 'pm'; // Default fallback for legacy messages
    if (profileContext) {
      // Extract profile type from context (e.g., "basic_basic" -> "basic")
      const profileType = profileContext.split('_')[0];
      if (['basic', 'love', 'business'].includes(profileType)) {
        collectionName = `private_messages_${profileType}`; // Use separate message collections
      }
      // Store profile context in the message for consistency
      message.profile_context = profileContext;
    }
    
    console.log(`Storing message in collection: ${collectionName} with profile context: ${profileContext}`);
    const insertResult = await db.collection(collectionName).insertOne(message);
    
    // Get sender and receiver usernames for notifications
    const [senderUser, receiverUser] = await Promise.all([
      db.collection('users').findOne({ user_id: auth.userId }, { projection: { username: 1 } }),
      db.collection('users').findOne({ user_id: receiver_id }, { projection: { username: 1 } })
    ]);
    
    // Send real-time notifications
    try {
      // Notify about the new message
      notifyNewMessage({
        message_id: insertResult.insertedId.toString(),
        sender_id: auth.userId,
        receiver_id,
        content,
        timestamp: now.toISOString(),
        conversation_participants: sortedParticipants
      });
      
      // If this is a new conversation, notify about that too
      if (isNewConversation && senderUser && receiverUser && conversationResult?.value) {
        // Notify receiver about new conversation
        notifyNewConversation({
          conversation_id: conversationResult.value._id.toString(),
          participants: sortedParticipants,
          other_user: {
            user_id: auth.userId,
            username: senderUser.username
          }
        });
      }
    } catch (error) {
      console.error('Error sending real-time notifications:', error);
      // Don't fail the request if notification fails
    }
    
    // Prepare the response message with decrypted content and proper fields
    const responseMessage = {
      _id: insertResult.insertedId,
      sender_id: auth.userId,
      receiver_id,
      content: sanitizedContent, // Return the original unencrypted content
      timestamp: now.toISOString(),
      is_read: false,
      attachments: attachments || [],
      ...(reply_to && { reply_to })
    };

    return NextResponse.json({ success: true, message: responseMessage });
  } catch (err) {
    console.error('Messages POST error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) }, { status: 500 });
  }
}

// PATCH: Mark messages as read
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    // Fast authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    const body = await request.json();
    const { sender_id, sender_profile_type, receiver_profile_type } = body;
    if (!sender_id) {
      return NextResponse.json({ success: false, message: 'Missing sender_id' }, { status: 400 });
    }
    
    // Mark messages as read across appropriate collections
    const sortedParticipants = getSortedParticipants(auth.userId, sender_id);
    
    let totalModifiedCount = 0;
    
    if (sender_profile_type && receiver_profile_type) {
      const profileContext = getProfileContext(sender_profile_type, receiver_profile_type, sortedParticipants, auth.userId);
      const profileType = profileContext.split('_')[0];
      const primaryCollection = ['basic', 'love', 'business'].includes(profileType) ? `private_messages_${profileType}` : 'pm';
      
      // Mark messages as read in profile-specific collection
      const profileQuery = {
        participant_ids: sortedParticipants,
        sender_id,
        is_read: false,
        profile_context: profileContext
      };
      
      const profileResult = await db.collection(primaryCollection).updateMany(
        profileQuery,
        { $set: { is_read: true } }
      );
      
      // Also mark legacy messages as read in main collection
      const legacyQuery = {
        participant_ids: sortedParticipants,
        sender_id,
        is_read: false,
        $or: [
          { profile_context: { $exists: false } },
          { profile_context: null }
        ]
      };
      
      const legacyResult = await db.collection('pm').updateMany(
        legacyQuery,
        { $set: { is_read: true } }
      );
      
      totalModifiedCount = profileResult.modifiedCount + legacyResult.modifiedCount;
      console.log(`Marked ${profileResult.modifiedCount} profile messages and ${legacyResult.modifiedCount} legacy messages as read`);
    } else {
      // Fallback for requests without profile context
      const query = {
        participant_ids: sortedParticipants,
        sender_id,
        is_read: false
      };
      
      const result = await db.collection('pm').updateMany(
        query,
        { $set: { is_read: true } }
      );
      
      totalModifiedCount = result.modifiedCount;
    }
    
    return NextResponse.json({ success: true, modifiedCount: totalModifiedCount });
  } catch (err) {
    console.error('Messages PATCH error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) }, { status: 500 });
  }
}

// DELETE: Delete conversation or individual message
export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    
    // Fast authentication
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    const body = await request.json();
    const { other_user_id, message_id, sender_profile_type, receiver_profile_type } = body;
    
    // If message_id is provided, delete individual message
    if (message_id) {
      // Convert string to ObjectId if needed
      let objectId;
      try {
        objectId = typeof message_id === 'string' ? new ObjectId(message_id) : message_id;
      } catch {
        return NextResponse.json({ success: false, message: 'Invalid message_id format' }, { status: 400 });
      }
      
      // Search for the message across all possible collections
      let message = null;
      let foundCollection = '';
      
      // Check profile-specific collections first
      for (const profileType of ['basic', 'love', 'business']) {
        const collectionName = `private_messages_${profileType}`; // Use message collections
        message = await db.collection(collectionName).findOne({ _id: objectId });
        if (message) {
          foundCollection = collectionName;
          break;
        }
      }
      
      // If not found in profile collections, check legacy 'pm' collection (if it still exists)
      if (!message) {
        message = await db.collection('pm').findOne({ _id: objectId });
        if (message) {
          foundCollection = 'pm';
        }
      }
      
      if (!message) {
        return NextResponse.json({ success: false, message: 'Message not found' }, { status: 404 });
      }
      
      // Check if user is the sender of the message
      if (message.sender_id !== auth.userId) {
        return NextResponse.json({ success: false, message: 'Not authorized to delete this message' }, { status: 403 });
      }
      
      // Delete the individual message from the correct collection
      const deleteResult = await db.collection(foundCollection).deleteOne({ _id: objectId });
      
      return NextResponse.json({ 
        success: true, 
        deletedMessages: deleteResult.deletedCount,
        type: 'message',
        collection: foundCollection
      });
    }
    
    // If other_user_id is provided, delete entire conversation
    if (!other_user_id) {
      return NextResponse.json({ success: false, message: 'Missing other_user_id or message_id' }, { status: 400 });
    }
    
    const sortedParticipants = getSortedParticipants(auth.userId, other_user_id);
    
    let totalDeletedMessages = 0;
    let totalDeletedConversations = 0;
    
    if (sender_profile_type && receiver_profile_type) {
      const profileContext = getProfileContext(sender_profile_type, receiver_profile_type, sortedParticipants, auth.userId);
      const profileType = profileContext.split('_')[0];
      const messagesCollection = ['basic', 'love', 'business'].includes(profileType) ? `private_messages_${profileType}` : 'pm';
      const conversationCollection = ['basic', 'love', 'business'].includes(profileType) ? `private_conversations_${profileType}` : 'private_conversations';
      
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
      
      // Also delete legacy messages from main collection if they exist
      const legacyDeleteQuery = {
        participant_ids: sortedParticipants,
        $or: [
          { profile_context: { $exists: false } },
          { profile_context: null }
        ]
      };
      
      const legacyMessagesResult = await db.collection('pm').deleteMany(legacyDeleteQuery);
      
      totalDeletedMessages = profileMessagesResult.deletedCount + legacyMessagesResult.deletedCount;
      totalDeletedConversations = profileConversationResult.deletedCount;
      
      console.log(`Deleted ${profileMessagesResult.deletedCount} profile messages and ${legacyMessagesResult.deletedCount} legacy messages`);
      console.log(`Deleted conversation metadata from ${conversationCollection}`);
    } else {
      // Fallback for requests without profile context - delete from legacy collections
      const conversationQuery = { participant_ids: sortedParticipants };
      
      const [deleteMessagesResult, deleteConversationResult] = await Promise.all([
        db.collection('pm').deleteMany(conversationQuery),
        db.collection('private_conversations').deleteOne(conversationQuery) // Delete conversation metadata from main collection
      ]);
      
      totalDeletedMessages = deleteMessagesResult.deletedCount;
      totalDeletedConversations = deleteConversationResult.deletedCount;
    }
    
    return NextResponse.json({ 
      success: true, 
      deletedMessages: totalDeletedMessages,
      deletedConversation: totalDeletedConversations,
      type: 'conversation'
    });
  } catch (err) {
    console.error('Messages DELETE error:', err);
    return NextResponse.json({ success: false, message: 'Server error', error: String(err) }, { status: 500 });
  }
}
