// SSE Notification utilities for real-time messaging
import { NewMessageData, NewConversationData } from '../components/hooks/useWebSocket';

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

// Notify about message read status
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
