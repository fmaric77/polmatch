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
}

// Notify about a new group message
export async function notifyNewGroupMessage(data: GroupMessageData): Promise<void> {
  try {
    // Get database connection
    const { db } = await connectToDatabase();
    
    // Fetch all group members
    const members = await db.collection('group_members').find({
      group_id: data.group_id
    }).toArray();
    
    // Get sender username if not provided
    let senderUsername = data.sender_username;
    if (!senderUsername) {
      const sender = await db.collection('users').findOne(
        { user_id: data.sender_id },
        { projection: { username: 1 } }
      );
      senderUsername = sender?.username || 'Unknown';
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
