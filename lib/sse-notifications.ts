// SSE Notification utilities for real-time messaging
import { NewMessageData, NewConversationData } from '../components/hooks/useWebSocket';
import { connectToDatabase } from './mongodb-connection';

// Global map to store active SSE connections by user ID
export type SSEWriter = {
  write: (chunk: Uint8Array) => Promise<void>;
  close?: () => void;
  abort?: () => void;
  [key: string]: unknown; // Allow additional properties from WritableStream
};

// Use globalThis to persist SSE connections across API route invocations
declare global {
  interface GlobalThis {
    __sseConnectionsGlobal?: Map<string, SSEWriter[]>;
  }
}

// Initialize or reuse the global connections map
const globalScope = (typeof globalThis !== 'undefined' ? globalThis : global) as GlobalThis;
const sseConnections: Map<string, SSEWriter[]> = globalScope.__sseConnectionsGlobal || new Map();
if (!globalScope.__sseConnectionsGlobal) {
  globalScope.__sseConnectionsGlobal = sseConnections;
}

// Helper function to format SSE data
function formatSSEData(type: string, data: unknown): string {
  return `data: ${JSON.stringify({ type, data })}\n\n`;
}

// Add a new SSE connection for a user
export function addSSEConnection(userId: string, writer: SSEWriter): void {
  console.log(`📝 addSSEConnection called for user ${userId}`);
  console.log(`📝 Current connections before adding:`, Array.from(sseConnections.keys()));
  
  if (!sseConnections.has(userId)) {
    sseConnections.set(userId, []);
  }
  sseConnections.get(userId)!.push(writer);
  
  console.log(`📝 Connections after adding user ${userId}:`, Array.from(sseConnections.keys()));
  console.log(`📝 User ${userId} now has ${sseConnections.get(userId)?.length} connections`);
}

// Remove an SSE connection for a user
export function removeSSEConnection(userId: string, writer: SSEWriter): void {
  console.log(`🗑️ removeSSEConnection called for user ${userId}`);
  const userConnections = sseConnections.get(userId);
  if (userConnections) {
    console.log(`🗑️ User ${userId} had ${userConnections.length} connections before removal`);
    const index = userConnections.indexOf(writer);
    if (index > -1) {
      userConnections.splice(index, 1);
      console.log(`🗑️ Removed connection at index ${index} for user ${userId}`);
    } else {
      console.log(`🗑️ Writer not found in connections for user ${userId}`);
    }
    if (userConnections.length === 0) {
      sseConnections.delete(userId);
      console.log(`🗑️ Removed user ${userId} from connections map (no connections left)`);
    } else {
      console.log(`🗑️ User ${userId} still has ${userConnections.length} connections`);
    }
  } else {
    console.log(`🗑️ No connections found for user ${userId} during removal`);
  }
}

// Debug function to check active connections
export function getActiveConnections(): Map<string, number> {
  const connectionCounts = new Map<string, number>();
  for (const [userId, connections] of sseConnections.entries()) {
    connectionCounts.set(userId, connections.length);
  }
  return connectionCounts;
}

// Debug function to log all active connections
export function logActiveConnections(): void {
  console.log('📊 Active SSE Connections:');
  if (sseConnections.size === 0) {
    console.log('  No active connections');
    return;
  }
  
  for (const [userId, connections] of sseConnections.entries()) {
    console.log(`  User ${userId}: ${connections.length} connection(s)`);
  }
}

// Send data to all connections for a specific user
async function sendToUser(userId: string, data: string): Promise<void> {
  const userConnections = sseConnections.get(userId);
  console.log(`📤 sendToUser called for user ${userId}, connections: ${userConnections?.length || 0}`);
  
  if (!userConnections || userConnections.length === 0) {
    console.log(`📤 No connections found for user ${userId}`);
    return;
  }

  const encoder = new TextEncoder();
  const promises = userConnections.map(async (writer, index) => {
    try {
      console.log(`📤 Sending data to user ${userId} connection ${index + 1}/${userConnections.length}`);
      await writer.write(encoder.encode(data));
      console.log(`📤 Successfully sent data to user ${userId} connection ${index + 1}`);
    } catch (error) {
      console.error(`📤 Error sending SSE data to user ${userId} connection ${index + 1}:`, error);
      // Remove failed connection
      removeSSEConnection(userId, writer);
    }
  });

  await Promise.all(promises);
  console.log(`📤 Finished sending data to all connections for user ${userId}`);
}

// Notify about a new message
export async function notifyNewMessage(data: NewMessageData): Promise<void> {
  console.log('🔔 SSE notifyNewMessage called with data:', {
    message_id: data.message_id,
    sender_id: data.sender_id,
    receiver_id: data.receiver_id,
    content: data.content?.substring(0, 50) + '...',
    conversation_participants: data.conversation_participants
  });
  
  // Log active connections
  logActiveConnections();
  
  const sseData = formatSSEData('NEW_MESSAGE', data);
  console.log('🔔 SSE data formatted:', sseData.substring(0, 100) + '...');
  
  // Send to receiver
  if (data.receiver_id) {
    console.log(`🔔 Sending SSE to receiver: ${data.receiver_id}`);
    await sendToUser(data.receiver_id, sseData);
  }
  
  // Also send to sender (for multi-device sync)
  console.log(`🔔 Sending SSE to sender: ${data.sender_id}`);
  await sendToUser(data.sender_id, sseData);
  
  console.log('🔔 SSE notifications sent successfully');
}

// Notify about a new conversation
export async function notifyNewConversation(data: NewConversationData): Promise<void> {
  const sseData = formatSSEData('NEW_CONVERSATION', data);
  
  // Send to all participants
  for (const participantId of data.participants) {
    await sendToUser(participantId, sseData);
  }
}

// Message read status interface and function
export interface MessageReadData {
  message_id: string;
  conversation_id: string;
  reader_id: string;
  participants: string[];
}

export async function notifyMessageRead(data: MessageReadData): Promise<void> {
  const sseData = formatSSEData('MESSAGE_READ', data);
  
  // Send to all participants
  for (const participantId of data.participants) {
    await sendToUser(participantId, sseData);
  }
}

// Typing indicator interfaces and functions
export interface TypingStartData {
  user_id: string;
  username: string;
  conversation_id: string;
  conversation_type: 'direct' | 'group';
  channel_id?: string;
  timestamp: string;
}

export interface TypingStopData {
  user_id: string;
  conversation_id: string;
  conversation_type: 'direct' | 'group';
  channel_id?: string;
}

// Notify about typing start
export async function notifyTypingStart(data: TypingStartData): Promise<void> {
  const sseData = formatSSEData('TYPING_START', data);
  
  if (data.conversation_type === 'direct') {
    // For direct messages, broadcast to all connections except the typer
    const allConnections = Array.from(sseConnections.keys());
    for (const userId of allConnections) {
      if (userId !== data.user_id) {
        await sendToUser(userId, sseData);
      }
    }
  } else {
    // For group messages, broadcast to all group members except the typer
    const allConnections = Array.from(sseConnections.keys());
    for (const userId of allConnections) {
      if (userId !== data.user_id) {
        await sendToUser(userId, sseData);
      }
    }
  }
}

// Notify about typing stop
export async function notifyTypingStop(data: TypingStopData): Promise<void> {
  const sseData = formatSSEData('TYPING_STOP', data);
  
  if (data.conversation_type === 'direct') {
    // For direct messages, broadcast to all connections except the typer
    const allConnections = Array.from(sseConnections.keys());
    for (const userId of allConnections) {
      if (userId !== data.user_id) {
        await sendToUser(userId, sseData);
      }
    }
  } else {
    // For group messages, broadcast to all group members except the typer
    const allConnections = Array.from(sseConnections.keys());
    for (const userId of allConnections) {
      if (userId !== data.user_id) {
        await sendToUser(userId, sseData);
      }
    }
  }
}

// Group message notification interface
export interface GroupMessageData {
  message_id: string;
  group_id: string;
  channel_id?: string;
  sender_id: string;
  content: string;
  timestamp: string;
  attachments?: string[];
  sender_username?: string;
  sender_display_name?: string;
  profile_type?: string;
  reply_to?: {
    message_id: string;
    content: string;
    sender_name: string;
  };
}

// Notify about a new group message
export async function notifyNewGroupMessage(data: GroupMessageData): Promise<void> {
  try {
    // Get database connection
    const { db } = await connectToDatabase();
    
    // Determine which profile collection to use based on profile_type
    const profileType = data.profile_type || 'basic';
    const profilesCollection = profileType === 'basic' ? 'basicprofiles' : `${profileType}profiles`;
    const membersCollection = profileType === 'basic' ? 'group_members' : `group_members_${profileType}`;
    
    // Fetch all group members
    const members = await db.collection(membersCollection).find({
      group_id: data.group_id
    }).toArray();
    
    // Get sender username and display name if not provided
    let senderUsername = data.sender_username;
    let senderDisplayName = data.sender_display_name;
    
    if (!senderUsername || !senderDisplayName) {
      // Get user's basic info
      const sender = await db.collection('users').findOne(
        { user_id: data.sender_id },
        { projection: { username: 1 } }
      );
      
      if (!senderUsername) {
        senderUsername = sender?.username || 'Unknown';
      }
      
      // Fetch display name from the correct profile collection based on profile_type
      if (!senderDisplayName) {
        const senderProfile = await db.collection(profilesCollection).findOne(
          { user_id: data.sender_id },
          { projection: { display_name: 1 } }
        );
        senderDisplayName = senderProfile?.display_name || senderUsername || 'Unknown';
      }
    }
    
    // Create SSE data with group-specific structure
    const groupMessageSSE = {
      message_id: data.message_id,
      group_id: data.group_id,
      channel_id: data.channel_id || '',
      sender_id: data.sender_id,
      content: data.content,
      timestamp: data.timestamp,
      attachments: data.attachments || [],
      sender_username: senderUsername,
      sender_display_name: senderDisplayName,
      total_members: members.length,
      read_count: 1, // Only sender has read it initially
      read_by_others: false,
      ...(data.reply_to && { reply_to: data.reply_to })
    };
    
    const sseData = formatSSEData('NEW_MESSAGE', groupMessageSSE);
    
    // Send to all group members
    for (const member of members) {
      await sendToUser(member.user_id, sseData);
    }
    
    console.log(`Sent group message notification to ${members.length} members`);
  } catch (error) {
    console.error('Error sending group message notification:', error);
  }
}

// Voice call notification interfaces and functions
export interface VoiceCallData {
  call_id: string;
  caller_id: string;
  caller_username: string;
  caller_display_name?: string;
  recipient_id: string;
  channel_name: string;
  call_type: 'voice' | 'video';
  status: 'calling' | 'accepted' | 'declined' | 'ended' | 'missed';
  created_at: string;
}

// Notify about an incoming voice call
export async function notifyIncomingCall(data: VoiceCallData): Promise<void> {
  console.log(`📞 Attempting to send incoming call notification to user ${data.recipient_id}`);
  console.log(`📞 Call data:`, data);
  
  // Log current connections
  logActiveConnections();
  
  const sseData = formatSSEData('INCOMING_CALL', data);
  await sendToUser(data.recipient_id, sseData);
  console.log(`📞 Sent incoming call notification to user ${data.recipient_id}`);
}

// Notify about call status updates (accepted, declined, ended)
export async function notifyCallStatusUpdate(data: VoiceCallData): Promise<void> {
  const sseData = formatSSEData('CALL_STATUS_UPDATE', data);
  
  // Send to both caller and recipient
  await sendToUser(data.caller_id, sseData);
  await sendToUser(data.recipient_id, sseData);
  
  console.log(`Sent call status update (${data.status}) to caller ${data.caller_id} and recipient ${data.recipient_id}`);
}

// Status change notification interface and function
export interface StatusChangeData {
  user_id: string;
  username: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  custom_message?: string;
  timestamp: string;
}

export async function notifyStatusChange(data: StatusChangeData): Promise<void> {
  console.log('🟢 SSE notifyStatusChange called for user:', data.user_id, 'status:', data.status);
  
  const { db } = await connectToDatabase();
  const sseData = formatSSEData('STATUS_CHANGE', data);
  
  try {
    // Get all users who should receive this status update
    const recipientIds = new Set<string>();
    
    // 1. Get all friends across all profile types
    const friendsCollections = ['friends', 'friends_basic', 'friends_love', 'friends_business'];
    
    for (const collectionName of friendsCollections) {
      try {
        const friendships = await db.collection(collectionName).find({
          $or: [
            { user_id: data.user_id, status: 'accepted' },
            { friend_id: data.user_id, status: 'accepted' }
          ]
        }).toArray();
        
        friendships.forEach(friendship => {
          const friendId = friendship.user_id === data.user_id ? friendship.friend_id : friendship.user_id;
          recipientIds.add(friendId);
        });
      } catch (error) {
        // Collection might not exist, continue
        console.log(`Collection ${collectionName} not found or error:`, error);
      }
    }
    
    // 2. Get all conversation participants (both direct and group conversations)
    
    // Direct conversations (all profile types)
    const conversationCollections = [
      'private_conversations',
      'private_conversations_basic',
      'private_conversations_love',
      'private_conversations_business'
    ];
    
    for (const collectionName of conversationCollections) {
      try {
        const conversations = await db.collection(collectionName).find({
          participant_ids: data.user_id
        }).toArray();
        
        conversations.forEach(conv => {
          conv.participant_ids.forEach((participantId: string) => {
            if (participantId !== data.user_id) {
              recipientIds.add(participantId);
            }
          });
        });
      } catch (error) {
        console.log(`Collection ${collectionName} not found or error:`, error);
      }
    }
    
    // Group conversations
    try {
      const groupMemberships = await db.collection('group_members').find({
        user_id: data.user_id,
        status: 'active'
      }).toArray();
      
      for (const membership of groupMemberships) {
        const groupMembers = await db.collection('group_members').find({
          group_id: membership.group_id,
          status: 'active'
        }).toArray();
        
        groupMembers.forEach(member => {
          if (member.user_id !== data.user_id) {
            recipientIds.add(member.user_id);
          }
        });
      }
    } catch (error) {
      console.log('Error fetching group memberships:', error);
    }
    
    console.log(`🟢 Sending status update to ${recipientIds.size} recipients:`, Array.from(recipientIds));
    
    // Send status update to all recipients
    const sendPromises = Array.from(recipientIds).map(recipientId => 
      sendToUser(recipientId, sseData)
    );
    
    await Promise.all(sendPromises);
    console.log('🟢 Status change notifications sent successfully');
    
  } catch (error) {
    console.error('Error sending status change notifications:', error);
  }
}
