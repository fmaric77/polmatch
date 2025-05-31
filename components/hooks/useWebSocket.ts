import { useEffect, useRef, useState, useCallback } from 'react';

interface SSEMessage {
  type: 'NEW_MESSAGE' | 'NEW_CONVERSATION' | 'MESSAGE_READ' | 'CONNECTION_ESTABLISHED';
  data: unknown;
}

export interface NewMessageData {
  message_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  conversation_participants: string[];
}

export interface NewConversationData {
  conversation_id: string;
  participants: string[];
  other_user: {
    user_id: string;
    username: string;
  };
}

interface MessageReadData {
  senderId: string;
  receiverId: string;
  messageIds: string[];
}

interface UseWebSocketOptions {
  onNewMessage?: (data: NewMessageData) => void;
  onNewConversation?: (data: NewConversationData) => void;
  onMessageRead?: (data: MessageReadData) => void;
  onConnectionEstablished?: () => void;
}

export function useWebSocket(sessionToken: string | null, options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const optionsRef = useRef(options);
  const maxReconnectAttempts = 5;

  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  console.log('useWebSocket hook called with token:', sessionToken ? sessionToken.substring(0, 10) + '...' : 'null');

  const connect = useCallback(() => {
    if (!sessionToken) {
      console.log('No session token available for SSE connection');
      return;
    }

    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      console.log('SSE already connected');
      return;
    }

    try {
      console.log('Attempting to connect to SSE with token:', sessionToken?.substring(0, 10) + '...');
      
      const sseUrl = `/api/sse?sessionToken=${encodeURIComponent(sessionToken)}`;
      console.log('SSE URL:', sseUrl);
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connected successfully');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          console.log('Raw SSE event data:', event.data);
          const message: SSEMessage = JSON.parse(event.data);
          console.log('Parsed SSE message:', message.type, message.data);

          switch (message.type) {
            case 'CONNECTION_ESTABLISHED':
              optionsRef.current.onConnectionEstablished?.();
              break;
            
            case 'NEW_MESSAGE':
              optionsRef.current.onNewMessage?.(message.data as NewMessageData);
              break;
            
            case 'NEW_CONVERSATION':
              optionsRef.current.onNewConversation?.(message.data as NewConversationData);
              break;
            
            case 'MESSAGE_READ':
              optionsRef.current.onMessageRead?.(message.data as MessageReadData);
              break;
            
            default:
              console.log('Unknown SSE message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error event:', error);
        console.error('SSE readyState:', eventSourceRef.current?.readyState);
        console.error('SSE url:', eventSourceRef.current?.url);
        setIsConnected(false);
        
        // Close the connection if it's in an error state
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Attempt to reconnect unless it was a deliberate close
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.pow(2, reconnectAttempts.current) * 1000; // Exponential backoff
          
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setConnectionError('Failed to connect after multiple attempts');
        }
      };

    } catch (error) {
      console.error('Error creating SSE connection:', error);
      setConnectionError('Failed to create SSE connection');
    }
  }, [sessionToken]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    setConnectionError(null);
    reconnectAttempts.current = 0;
  }, []);

  // Connect when session token is available
  useEffect(() => {
    console.log('useWebSocket useEffect triggered with sessionToken:', sessionToken ? sessionToken.substring(0, 10) + '...' : 'null');
    if (sessionToken) {
      console.log('Calling connect() with session token');
      connect();
    } else {
      console.log('No session token yet, waiting...');
      // Don't disconnect when sessionToken is null initially
      // Only disconnect when we explicitly want to close the connection
    }

    return () => {
      console.log('useWebSocket cleanup called');
      disconnect();
    };
  }, [sessionToken, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    connectionError,
    connect,
    disconnect
  };
}
