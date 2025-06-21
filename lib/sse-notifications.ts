// SSE Notification utilities for real-time messaging
import { NewMessageData, NewConversationData } from '../components/hooks/useWebSocket';
import { connectToDatabase } from './mongodb-connection';

// Global map to store active SSE connections by user ID
const sseConnections = new Map<string, WritableStreamDefaultWriter<Uint8Array>[]>();

// Helper function to format SSE data
function formatSSEData(type: string, data: unknown): string {
  return `data: ${JSON.stringify({ type, data })}\n\n`;
}

// Add a new SSE connection for a user
export function addSSEConnection(userId: string, writer: WritableStreamDefaultWriter<Uint8Array>): void {
  if (!sseConnections.has(userId)) {
    sseConnections.set(userId, []);
  }
  sseConnections.get(userId)!.push(writer);
}

// Remove an SSE connection for a user
export function removeSSEConnection(userId: string, writer: WritableStreamDefaultWriter<Uint8Array>): void {
  const userConnections = sseConnections.get(userId);
  if (userConnections) {
    const index = userConnections.indexOf(writer);
    if (index > -1) {
      userConnections.splice(index, 1);
    }
    if (userConnections.length === 0) {
      sseConnections.delete(userId);
    }
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
  if (!userConnections || userConnections.length === 0) {
    return;
  }

  const encoder = new TextEncoder();
  const promises = userConnections.map(async (writer) => {
    try {
      await writer.write(encoder.encode(data));
    } catch (error) {
      console.error(`Error sending SSE data to user ${userId}:`, error);
      // Remove failed connection
      removeSSEConnection(userId, writer);
    }
  });

  await Promise.all(promises);
}

// Notify about a new message
export async function notifyNewMessage(data: NewMessageData): Promise<void> {
  const sseData = formatSSEData('NEW_MESSAGE', data);
  
  // Send to receiver
  if (data.receiver_id) {
    await sendToUser(data.receiver_id, sseData);
  }
  
  // Also send to sender (for multi-device sync)
  await sendToUser(data.sender_id, sseData);
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
      read_by_others: false
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
