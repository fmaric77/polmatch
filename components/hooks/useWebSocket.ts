import { useEffect, useRef, useState, useCallback } from 'react';
import { TypingData } from './useTypingIndicator';

interface SSEMessage {
  type: 'NEW_MESSAGE' | 'NEW_CONVERSATION' | 'MESSAGE_READ' | 'CONNECTION_ESTABLISHED' | 'TYPING_START' | 'TYPING_STOP' | 'INCOMING_CALL' | 'CALL_STATUS_UPDATE' | 'STATUS_CHANGE';
  data: unknown;
}

export interface NewMessageData {
  message_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  conversation_participants: string[];
  reply_to?: {
    message_id: string;
    content: string;
    sender_name: string;
  };
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

export interface VoiceCallEventData {
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

interface UseWebSocketOptions {
  onNewMessage?: (data: NewMessageData) => void;
  onNewConversation?: (data: NewConversationData) => void;
  onMessageRead?: (data: MessageReadData) => void;
  onConnectionEstablished?: () => void;
  onTypingStart?: (data: TypingData) => void;
  onTypingStop?: (data: Pick<TypingData, 'user_id' | 'conversation_id' | 'conversation_type' | 'channel_id'>) => void;
  onIncomingCall?: (data: VoiceCallEventData) => void;
  onCallStatusUpdate?: (data: VoiceCallEventData) => void;
  onStatusChange?: (data: unknown) => void;
}

export function useWebSocket(sessionToken: string | null, options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const optionsRef = useRef(options);
  const sessionTokenRef = useRef(sessionToken);
  const maxReconnectAttempts = 5;

  // Update refs when values change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  // Debug: Set global window flag for SSE connection status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { __sseConnected?: boolean; __sseConnectionError?: string | null }).__sseConnected = isConnected;
      (window as Window & { __sseConnected?: boolean; __sseConnectionError?: string | null }).__sseConnectionError = connectionError;
    }
  }, [isConnected, connectionError]);

  console.log('useWebSocket hook called with token:', sessionToken ? sessionToken.substring(0, 10) + '...' : 'null');

  const connect = useCallback(() => {
    const currentSessionToken = sessionTokenRef.current;
    if (!currentSessionToken) {
      console.log('🔌 No session token available for SSE connection');
      return;
    }

    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      console.log('🔌 SSE already connected, skipping reconnect');
      return;
    }

    // Clean up any existing connection first
    if (eventSourceRef.current) {
      console.log('🔌 Cleaning up existing SSE connection before reconnect');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      console.log('🔌 Attempting to connect to SSE with token:', currentSessionToken?.substring(0, 10) + '...');
      
      const sseUrl = `/api/sse?sessionToken=${encodeURIComponent(currentSessionToken)}`;
      console.log('🔌 SSE URL:', sseUrl);
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('✅ SSE connected successfully');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
        
        // Start health check interval
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
        }
        
        healthCheckIntervalRef.current = setInterval(() => {
          if (eventSourceRef.current?.readyState !== EventSource.OPEN) {
            console.log('🩺 Health check: SSE connection lost (readyState:', eventSourceRef.current?.readyState, '), attempting reconnect...');
            setIsConnected(false);
            // Don't use the error handler's reconnection logic, use our own
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
            
            // Clear the health check to avoid multiple reconnects
            if (healthCheckIntervalRef.current) {
              clearInterval(healthCheckIntervalRef.current);
              healthCheckIntervalRef.current = null;
            }
            
            // Immediately reconnect for health check failures
            reconnectAttempts.current = 0;
            setTimeout(() => connect(), 500); // Faster reconnection
          } else {
            console.log('🩺 Health check: SSE connection is healthy (readyState:', eventSourceRef.current?.readyState, ')');
          }
        }, 5000); // Increased interval to reduce spam
      };

      eventSource.onmessage = (event) => {
        try {
          console.log('📨 Raw SSE event data:', event.data);
          const message: SSEMessage = JSON.parse(event.data);
          console.log('📨 Parsed SSE message:', message.type, message.data);

          switch (message.type) {
            case 'CONNECTION_ESTABLISHED':
              console.log('🔗 SSE connection established event received');
              optionsRef.current.onConnectionEstablished?.();
              break;
            
            case 'NEW_MESSAGE':
              console.log('💬 New message event received');
              optionsRef.current.onNewMessage?.(message.data as NewMessageData);
              break;
            
            case 'NEW_CONVERSATION':
              console.log('💬 New conversation event received');
              optionsRef.current.onNewConversation?.(message.data as NewConversationData);
              break;
            
            case 'MESSAGE_READ':
              console.log('👁️ Message read event received');
              optionsRef.current.onMessageRead?.(message.data as MessageReadData);
              break;
            
            case 'TYPING_START':
              console.log('⌨️ Typing start event received');
              optionsRef.current.onTypingStart?.(message.data as TypingData);
              break;
            
            case 'TYPING_STOP':
              console.log('⌨️ Typing stop event received');
              optionsRef.current.onTypingStop?.(message.data as Pick<TypingData, 'user_id' | 'conversation_id' | 'conversation_type' | 'channel_id'>);
              break;
            
            case 'INCOMING_CALL':
              console.log('📞 Incoming call event received:', message.data);
              optionsRef.current.onIncomingCall?.(message.data as VoiceCallEventData);
              break;
            
            case 'CALL_STATUS_UPDATE':
              console.log('📞 Call status update event received:', message.data);
              optionsRef.current.onCallStatusUpdate?.(message.data as VoiceCallEventData);
              break;
            
            case 'STATUS_CHANGE':
              console.log('🟢 User status change event received:', message.data);
              optionsRef.current.onStatusChange?.(message.data);
              break;
            
            default:
              console.log('❓ Unknown SSE message type:', message.type);
          }
        } catch (error) {
          console.error('❌ Error parsing SSE message:', error, 'Raw data:', event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE error event:', error);
        console.error('SSE readyState:', eventSourceRef.current?.readyState);
        console.error('SSE url:', eventSourceRef.current?.url);
        setIsConnected(false);
        
        // Check if this is a connection close (readyState 2) and attempt reconnect
        const currentReadyState = eventSourceRef.current?.readyState;
        
        // Close the connection if it's in an error state
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Always attempt to reconnect unless we've exhausted attempts
        // This ensures we reconnect even after normal connection closes
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(Math.pow(2, reconnectAttempts.current) * 1000, 30000); // Max 30s delay
          
          console.log(`🔄 SSE reconnection attempt ${reconnectAttempts.current}/${maxReconnectAttempts} in ${delay}ms (readyState was: ${currentReadyState})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Executing SSE reconnection...');
            connect();
          }, delay);
        } else {
          console.error('❌ SSE connection failed after maximum reconnection attempts');
          setConnectionError('Failed to connect after multiple attempts');
          // Reset attempts after a longer delay to allow manual retry
          setTimeout(() => {
            reconnectAttempts.current = 0;
            console.log('🔄 Reset SSE reconnection attempts, ready for retry');
          }, 60000); // Reset after 1 minute
        }
      };

    } catch (error) {
      console.error('Error creating SSE connection:', error);
      setConnectionError('Failed to create SSE connection');
    }
  }, []); // Empty dependencies - use refs for dynamic values

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting SSE...');
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    setConnectionError(null);
    reconnectAttempts.current = 0;
  }, []);

  const reconnect = useCallback(() => {
    console.log('🔄 Manual SSE reconnection requested');
    disconnect();
    reconnectAttempts.current = 0;
    setConnectionError(null);
    // Small delay to ensure cleanup completes
    setTimeout(() => {
      connect();
    }, 100);
  }, []); // Remove dependencies to make it stable

  // Connect when session token is available - simplified dependencies
  useEffect(() => {
    console.log('useWebSocket useEffect triggered with sessionToken:', sessionToken ? sessionToken.substring(0, 10) + '...' : 'null');
    if (sessionToken) {
      console.log('Calling connect() with session token');
      connect();
    } else {
      console.log('No session token yet, waiting...');
    }

    return () => {
      console.log('useWebSocket cleanup called');
      disconnect();
    };
  }, [sessionToken]); // Only depend on sessionToken now

  // Listen for custom reconnection requests (e.g., from VoiceCall component)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleReconnectionRequest = () => {
      if (sessionTokenRef.current && !isConnected) {
        console.log('🔄 Received SSE reconnection request, attempting reconnect...');
        disconnect();
        setTimeout(() => connect(), 100);
      }
    };

    window.addEventListener('requestSSEReconnection', handleReconnectionRequest);

    return () => {
      window.removeEventListener('requestSSEReconnection', handleReconnectionRequest);
    };
  }, [isConnected]); // Only depend on isConnected

  // Monitor for audio context changes that might affect SSE connections
  useEffect(() => {
    if (!sessionToken || typeof window === 'undefined') return;

    const checkAudioState = () => {
      try {
        // Check if AudioContext exists and is running
        const windowWithAudio = window as Window & {
          audioContext?: AudioContext;
          AudioContext?: typeof AudioContext;
          webkitAudioContext?: typeof AudioContext;
        };
        
        const AudioContextClass = windowWithAudio.AudioContext || windowWithAudio.webkitAudioContext;
        if (!AudioContextClass) return;
        
        const audioContext = windowWithAudio.audioContext || 
                           new AudioContextClass();
        
        if (audioContext && (audioContext as AudioContext).state === 'running') {
          console.log('🎵 Audio context is running, ensuring SSE connection...');
          if (!isConnected) {
            console.log('🔄 Audio active but SSE disconnected, reconnecting...');
            // Use disconnect and connect directly
            disconnect();
            setTimeout(() => connect(), 100);
          }
        }
      } catch {
        // Audio API not available or error accessing it, no action needed
      }
    };

    // Check audio state periodically when we have a session token - reduced frequency
    const audioContextMonitor = setInterval(checkAudioState, 10000); // Check every 10 seconds instead of 3

    return () => {
      if (audioContextMonitor) {
        clearInterval(audioContextMonitor);
      }
    };
  }, [sessionToken, isConnected]); // Remove connect and disconnect from dependencies

  // Reconnect when page becomes visible (useful for mobile and tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && sessionTokenRef.current) {
        console.log('📱 Page became visible, checking SSE connection...');
        if (!isConnected) {
          console.log('🔄 Page visible but SSE disconnected, attempting reconnect...');
          disconnect();
          setTimeout(() => connect(), 100);
        } else {
          console.log('✅ Page visible and SSE already connected');
        }
      }
    };

    const handleFocus = () => {
      if (sessionTokenRef.current) {
        console.log('👁️ Window focused, checking SSE connection...');
        if (!isConnected) {
          console.log('🔄 Window focused but SSE disconnected, attempting reconnect...');
          disconnect();
          setTimeout(() => connect(), 100);
        }
      }
    };

    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, [isConnected]); // Only depend on isConnected, use sessionTokenRef for token access

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
    disconnect,
    reconnect
  };
}
