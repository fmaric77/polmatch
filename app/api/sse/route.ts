import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '../../../lib/mongodb-connection';

// Store active SSE connections
const activeConnections = new Map<string, Set<ReadableStreamDefaultController>>();

interface SSEMessage {
  type: 'NEW_MESSAGE' | 'NEW_CONVERSATION' | 'MESSAGE_READ' | 'CONNECTION_ESTABLISHED';
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

// Utility functions to send real-time updates
export function notifyNewMessage(messageData: NewMessageData): void {
  console.log('SSE: Notifying new message:', messageData);
  console.log('SSE: Active connections:', Array.from(activeConnections.keys()));
  
  // Notify all participants in the conversation
  messageData.conversation_participants.forEach(userId => {
    const userConnections = activeConnections.get(userId);
    console.log(`SSE: User ${userId} has ${userConnections?.size || 0} connections`);
    
    if (userConnections) {
      const message: SSEMessage = {
        type: 'NEW_MESSAGE',
        data: messageData
      };
      
      console.log(`SSE: Sending message to ${userConnections.size} connections for user ${userId}`);
      
      userConnections.forEach(controller => {
        try {
          controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
          console.log(`SSE: Successfully sent message to user ${userId}`);
        } catch (error) {
          console.error('SSE: Error sending message:', error);
          // Remove broken connection
          userConnections.delete(controller);
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
      const message: SSEMessage = {
        type: 'NEW_CONVERSATION',
        data: conversationData
      };
      
      userConnections.forEach(controller => {
        try {
          controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
        } catch (error) {
          console.error('Error sending SSE message:', error);
          // Remove broken connection
          userConnections.delete(controller);
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
    const message: SSEMessage = {
      type: 'MESSAGE_READ',
      data: { senderId, receiverId, messageIds }
    };
    
    senderConnections.forEach(controller => {
      try {
        controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
      } catch (error) {
        console.error('Error sending SSE message:', error);
        // Remove broken connection
        senderConnections.delete(controller);
      }
    });
  }
}

// SSE endpoint
export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const sessionToken = url.searchParams.get('sessionToken');
  
  console.log('SSE connection attempt with token:', sessionToken?.substring(0, 10) + '...');
  
  if (!sessionToken) {
    console.log('SSE: Missing session token');
    return new Response(JSON.stringify({ error: 'Missing session token' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  console.log('SSE: Attempting to authenticate user...');
  const auth = await getAuthenticatedUser(sessionToken);
  console.log('SSE: Authentication result:', auth ? 'SUCCESS' : 'FAILED');
  
  if (!auth) {
    console.log('SSE: Invalid session token');
    return new Response(JSON.stringify({ error: 'Invalid session token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const userId = auth.userId;
  console.log(`SSE: User ${userId} connected via SSE`);
  
  // Create SSE stream
  const stream = new ReadableStream({
    start(controller) {
      // Add connection to active connections
      if (!activeConnections.has(userId)) {
        activeConnections.set(userId, new Set());
      }
      activeConnections.get(userId)!.add(controller);
      
      console.log(`SSE: Added connection for user ${userId}. Total connections for user: ${activeConnections.get(userId)!.size}`);
      console.log(`SSE: Total users connected: ${activeConnections.size}`);
      
      // Send connection established message
      const message: SSEMessage = {
        type: 'CONNECTION_ESTABLISHED',
        data: { userId }
      };
      controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
      
      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(`: ping\n\n`);
        } catch (error) {
          console.error('SSE ping failed:', error);
          clearInterval(pingInterval);
          // Remove connection
          const userConnections = activeConnections.get(userId);
          if (userConnections) {
            userConnections.delete(controller);
            if (userConnections.size === 0) {
              activeConnections.delete(userId);
            }
          }
        }
      }, 30000); // Ping every 30 seconds
      
      // Handle connection close
      request.signal.addEventListener('abort', () => {
        console.log(`User ${userId} disconnected from SSE`);
        clearInterval(pingInterval);
        const userConnections = activeConnections.get(userId);
        if (userConnections) {
          userConnections.delete(controller);
          if (userConnections.size === 0) {
            activeConnections.delete(userId);
          }
        }
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    }
  });
}

// OPTIONS handler for CORS preflight
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
