import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '../../../lib/mongodb-connection';
import { addSSEConnection, removeSSEConnection } from '../../../lib/sse-notifications';

interface SSEMessage {
  type: 'NEW_MESSAGE' | 'NEW_CONVERSATION' | 'MESSAGE_READ' | 'CONNECTION_ESTABLISHED' | 'TYPING_START' | 'TYPING_STOP' | 'INCOMING_CALL' | 'CALL_STATUS_UPDATE';
  data: unknown;
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
      const encoder = new TextEncoder();
      
      // Create a writable stream writer for the notification system
      const writableStream = new WritableStream({
        write(chunk) {
          try {
            controller.enqueue(chunk);
          } catch (error) {
            console.error('Error writing to SSE stream:', error);
          }
        }
      });
      const writer = writableStream.getWriter();
      
      // Register connection with notification system
      addSSEConnection(userId, writer);
      
      // Track connection start time
      const connectionStartTime = Date.now();
      
      console.log(`SSE: Added connection for user ${userId}`);
      
      // Send connection established message
      const message: SSEMessage = {
        type: 'CONNECTION_ESTABLISHED',
        data: { userId }
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
      
      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch (error) {
          console.error('SSE ping failed:', error);
          clearInterval(pingInterval);
          removeSSEConnection(userId, writer);
        }
      }, 30000); // Ping every 30 seconds
      
      // Handle connection close
      request.signal.addEventListener('abort', () => {
        console.log(`🔌 User ${userId} disconnected from SSE (reason: ${request.signal.reason || 'unknown'})`);
        console.log(`🔌 Connection lasted: ${Date.now() - connectionStartTime}ms`);
        clearInterval(pingInterval);
        removeSSEConnection(userId, writer);
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
        ? process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'
        : 'http://localhost:3000',
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
      'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
        ? process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'
        : 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
