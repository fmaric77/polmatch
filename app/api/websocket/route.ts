import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { getAuthenticatedUser } from '../../../lib/mongodb-connection';

// Store active WebSocket connections
const activeConnections = new Map<string, Set<WebSocket>>();

interface WebSocketMessage {
  type: 'NEW_MESSAGE' | 'NEW_CONVERSATION' | 'MESSAGE_READ' | 'USER_TYPING';
  data: unknown;
}

interface NewMessageData {
  message_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  conversation_participants: string[];
}

interface NewConversationData {
  conversation_id: string;
  participants: string[];
  other_user: {
    user_id: string;
    username: string;
  };
}

// WebSocket server instance
let wss: WebSocketServer | null = null;

// Initialize WebSocket server
if (!wss) {
  wss = new WebSocketServer({ port: 8080 });
  
  wss.on('connection', async (ws, request) => {
    console.log('New WebSocket connection');
    
    // Extract session token from the connection request
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const sessionToken = url.searchParams.get('sessionToken');
    
    if (!sessionToken) {
      ws.close(1008, 'Missing session token');
      return;
    }
    
    // Authenticate the user
    const auth = await getAuthenticatedUser(sessionToken);
    if (!auth) {
      ws.close(1008, 'Invalid session token');
      return;
    }
    
    const userId = auth.userId;
    console.log(`User ${userId} connected via WebSocket`);
    
    // Add connection to active connections
    if (!activeConnections.has(userId)) {
      activeConnections.set(userId, new Set());
    }
    activeConnections.get(userId)!.add(ws as WebSocket);
    
    // Handle connection close
    ws.on('close', () => {
      console.log(`User ${userId} disconnected from WebSocket`);
      const userConnections = activeConnections.get(userId);
      if (userConnections) {
        userConnections.delete(ws as WebSocket);
        if (userConnections.size === 0) {
          activeConnections.delete(userId);
        }
      }
    });
    
    // Handle incoming messages (for typing indicators, etc.)
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        console.log(`Received WebSocket message from ${userId}:`, message.type);
        
        // Handle different message types
        switch (message.type) {
          case 'USER_TYPING':
            // Broadcast typing indicator to conversation participants
            // Implementation can be added later if needed
            break;
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    // Send connection confirmation
    ws.send(JSON.stringify({
      type: 'CONNECTION_ESTABLISHED',
      data: { userId }
    }));
  });
}

// Utility functions to send real-time updates
export function notifyNewMessage(messageData: NewMessageData): void {
  console.log('Notifying new message:', messageData);
  
  // Notify all participants in the conversation
  messageData.conversation_participants.forEach(userId => {
    const userConnections = activeConnections.get(userId);
    if (userConnections) {
      const messageToSend: WebSocketMessage = {
        type: 'NEW_MESSAGE',
        data: messageData
      };
      
      userConnections.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(messageToSend));
        }
      });
    }
  });
}

export function notifyNewConversation(conversationData: NewConversationData): void {
  console.log('Notifying new conversation:', conversationData);
  
  // Notify all participants about the new conversation
  conversationData.participants.forEach(userId => {
    const userConnections = activeConnections.get(userId);
    if (userConnections) {
      const messageToSend: WebSocketMessage = {
        type: 'NEW_CONVERSATION',
        data: conversationData
      };
      
      userConnections.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify(messageToSend));
        }
      });
    }
  });
}

export function notifyMessageRead(senderId: string, receiverId: string, messageIds: string[]): void {
  console.log('Notifying message read:', { senderId, receiverId, messageIds });
  
  // Notify the sender that their messages have been read
  const senderConnections = activeConnections.get(senderId);
  if (senderConnections) {
    const messageToSend: WebSocketMessage = {
      type: 'MESSAGE_READ',
      data: { senderId, receiverId, messageIds }
    };
    
    senderConnections.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(messageToSend));
      }
    });
  }
}

// HTTP endpoint for getting connection status (optional)
export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const sessionToken = url.searchParams.get('sessionToken');
  
  if (!sessionToken) {
    return new Response(JSON.stringify({ error: 'Missing session token' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const auth = await getAuthenticatedUser(sessionToken);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Invalid session token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const isConnected = activeConnections.has(auth.userId);
  const connectionCount = activeConnections.get(auth.userId)?.size || 0;
  
  return new Response(JSON.stringify({
    connected: isConnected,
    connectionCount,
    totalConnections: activeConnections.size
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
