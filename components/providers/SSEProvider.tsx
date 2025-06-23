'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import type { NewMessageData, NewConversationData, VoiceCallEventData } from '../hooks/useWebSocket';
import { TypingData } from '../hooks/useTypingIndicator';

interface SSEContextType {
  isConnected: boolean;
  connectionError: string | null;
  sessionToken: string | null;
  currentUser: { user_id: string; username: string; is_admin?: boolean } | null;
  refreshConnection: () => void;
  // Add callback setters for other components to register their handlers
  setMessageHandler: (handler: ((data: NewMessageData) => void) | null) => void;
  setConversationHandler: (handler: ((data: NewConversationData) => void) | null) => void;
  setConnectionHandler: (handler: (() => void) | null) => void;
  setTypingStartHandler: (handler: ((data: TypingData) => void) | null) => void;
  setTypingStopHandler: (handler: ((data: Pick<TypingData, 'user_id' | 'conversation_id' | 'conversation_type' | 'channel_id'>) => void) | null) => void;
  setIncomingCallHandler: (handler: ((data: VoiceCallEventData) => void) | null) => void;
  setCallStatusUpdateHandler: (handler: ((data: VoiceCallEventData) => void) | null) => void;
}

const SSEContext = createContext<SSEContextType | undefined>(undefined);

export function useSSE(): SSEContextType {
  const context = useContext(SSEContext);
  if (context === undefined) {
    throw new Error('useSSE must be used within an SSEProvider');
  }
  return context;
}

interface SSEProviderProps {
  children: ReactNode;
  onNewMessage?: (data: NewMessageData) => void;
  onNewConversation?: (data: NewConversationData) => void;
  onConnectionEstablished?: () => void;
}

export function SSEProvider({ 
  children, 
  onNewMessage, 
  onNewConversation, 
  onConnectionEstablished 
}: SSEProviderProps): JSX.Element {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ user_id: string; username: string; is_admin?: boolean } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Handler refs to allow other components to register their handlers
  const messageHandlerRef = useRef<((data: NewMessageData) => void) | null>(onNewMessage || null);
  const conversationHandlerRef = useRef<((data: NewConversationData) => void) | null>(onNewConversation || null);
  const connectionHandlerRef = useRef<(() => void) | null>(onConnectionEstablished || null);
  const typingStartHandlerRef = useRef<((data: TypingData) => void) | null>(null);
  const typingStopHandlerRef = useRef<((data: Pick<TypingData, 'user_id' | 'conversation_id' | 'conversation_type' | 'channel_id'>) => void) | null>(null);
  const incomingCallHandlerRef = useRef<((data: VoiceCallEventData) => void) | null>(null);
  const callStatusUpdateHandlerRef = useRef<((data: VoiceCallEventData) => void) | null>(null);

  // Fetch session data once when provider mounts
  useEffect(() => {
    console.log('🔧 SSEProvider: Fetching session data...');
    fetch('/api/session')
      .then(res => res.json())
      .then(data => {
        console.log('🔧 SSEProvider: Session response:', data);
        if (data.valid && data.user) {
          setCurrentUser({ 
            user_id: data.user.user_id, 
            username: data.user.username, 
            is_admin: data.user.is_admin 
          });
          if (data.sessionToken) {
            console.log('🔧 SSEProvider: Setting session token:', data.sessionToken.substring(0, 10) + '...');
            setSessionToken(data.sessionToken);
          } else {
            console.error('🔧 SSEProvider: No session token in response!');
          }
        }
      })
      .catch(err => {
        console.error('🔧 SSEProvider: Session fetch error:', err);
      });
  }, [refreshTrigger]);

  // WebSocket connection with all handlers
  const { isConnected, connectionError } = useWebSocket(sessionToken, {
    onNewMessage: (data) => {
      console.log('SSEProvider: Received new message');
      messageHandlerRef.current?.(data);
    },
    onNewConversation: (data) => {
      console.log('SSEProvider: Received new conversation');
      conversationHandlerRef.current?.(data);
    },
    onConnectionEstablished: () => {
      console.log('SSEProvider: Connection established');
      connectionHandlerRef.current?.();
    },
    onTypingStart: (data) => {
      console.log('SSEProvider: Typing start');
      typingStartHandlerRef.current?.(data);
    },
    onTypingStop: (data) => {
      console.log('SSEProvider: Typing stop');
      typingStopHandlerRef.current?.(data);
    },
    onIncomingCall: (data) => {
      console.log('SSEProvider: Incoming call');
      incomingCallHandlerRef.current?.(data);
    },
    onCallStatusUpdate: (data) => {
      console.log('SSEProvider: Call status update');
      callStatusUpdateHandlerRef.current?.(data);
    }
  });

  const refreshConnection = () => {
    console.log('🔧 SSEProvider: Refreshing connection...');
    setRefreshTrigger(prev => prev + 1);
  };

  // Handler setter functions
  const setMessageHandler = useCallback((handler: ((data: NewMessageData) => void) | null) => {
    messageHandlerRef.current = handler;
  }, []);

  const setConversationHandler = useCallback((handler: ((data: NewConversationData) => void) | null) => {
    conversationHandlerRef.current = handler;
  }, []);

  const setConnectionHandler = useCallback((handler: (() => void) | null) => {
    connectionHandlerRef.current = handler;
  }, []);

  const setTypingStartHandler = useCallback((handler: ((data: TypingData) => void) | null) => {
    typingStartHandlerRef.current = handler;
  }, []);

  const setTypingStopHandler = useCallback((handler: ((data: Pick<TypingData, 'user_id' | 'conversation_id' | 'conversation_type' | 'channel_id'>) => void) | null) => {
    typingStopHandlerRef.current = handler;
  }, []);

  const setIncomingCallHandler = useCallback((handler: ((data: VoiceCallEventData) => void) | null) => {
    incomingCallHandlerRef.current = handler;
  }, []);

  const setCallStatusUpdateHandler = useCallback((handler: ((data: VoiceCallEventData) => void) | null) => {
    callStatusUpdateHandlerRef.current = handler;
  }, []);

  const contextValue: SSEContextType = {
    isConnected,
    connectionError,
    sessionToken,
    currentUser,
    refreshConnection,
    setMessageHandler,
    setConversationHandler,
    setConnectionHandler,
    setTypingStartHandler,
    setTypingStopHandler,
    setIncomingCallHandler,
    setCallStatusUpdateHandler
  };

  return (
    <SSEContext.Provider value={contextValue}>
      {children}
    </SSEContext.Provider>
  );
}
