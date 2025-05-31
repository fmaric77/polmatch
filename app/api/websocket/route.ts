import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { getAuthenticatedUser } from '../../../lib/mongodb-connection';

// Store active WebSocket connections
const activeConnections = new Map<string, Set<WebSocket>>();

interface WebSocketMessage {
  type: 'NEW_MESSAGE' | 'NEW_CONVERSATION' | 'MESSAGE_READ' | 'USER_TYPING';
  data: unknown;
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
