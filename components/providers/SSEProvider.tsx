'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface SSEContextType {
  isConnected: boolean;
  connectionError: string | null;
  sessionToken: string | null;
  currentUser: { user_id: string; username: string; is_admin?: boolean } | null;
  refreshConnection: () => void;
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
  onNewMessage?: (data: any) => void;
  onNewConversation?: (data: any) => void;
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

  // WebSocket connection with persistent handlers
  const { isConnected, connectionError } = useWebSocket(sessionToken, {
    onNewMessage,
    onNewConversation,
    onConnectionEstablished
  });

  const refreshConnection = () => {
    console.log('🔧 SSEProvider: Refreshing connection...');
    setRefreshTrigger(prev => prev + 1);
  };

  const contextValue: SSEContextType = {
    isConnected,
    connectionError,
    sessionToken,
    currentUser,
    refreshConnection
  };

  return (
    <SSEContext.Provider value={contextValue}>
      {children}
    </SSEContext.Provider>
  );
}
