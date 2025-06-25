import { useState, useCallback, useRef, useEffect } from 'react';
import { useCSRFToken } from './useCSRFToken';

export interface TypingData {
  user_id: string;
  username: string;
  conversation_id: string;
  conversation_type: 'direct' | 'group';
  channel_id?: string;
  timestamp: string;
}

interface UseTypingIndicatorOptions {
  currentUser: { user_id: string; username: string } | null;
  selectedConversation: string;
  selectedConversationType: 'direct' | 'group';
  selectedChannel?: string;
  sessionToken: string | null;
}

export const useTypingIndicator = ({
  currentUser,
  selectedConversation,
  selectedConversationType,
  selectedChannel,
  sessionToken
}: UseTypingIndicatorOptions) => {
  const { protectedFetch } = useCSRFToken();
  const [typingUsers, setTypingUsers] = useState<TypingData[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingEmitRef = useRef<number>(0);
  const isTypingRef = useRef<boolean>(false);

  // Clean up typing indicators every 5 seconds
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => prev.filter(typing => {
        const typingTime = new Date(typing.timestamp).getTime();
        return now - typingTime < 5000; // Remove typing indicators older than 5 seconds
      }));
    }, 1000);

    return () => clearInterval(cleanupInterval);
  }, []);

  // Clear typing indicators when conversation changes
  useEffect(() => {
    setTypingUsers([]);
    isTypingRef.current = false;
  }, [selectedConversation, selectedChannel]);

  const emitTyping = useCallback(async () => {
    if (!currentUser || !selectedConversation || !sessionToken) return;

    const now = Date.now();
    
    // Throttle typing events - only emit once every 2 seconds
    if (now - lastTypingEmitRef.current < 2000) return;
    
    lastTypingEmitRef.current = now;
    isTypingRef.current = true;

    try {
      await protectedFetch('/api/typing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: selectedConversation,
          conversation_type: selectedConversationType,
          channel_id: selectedChannel,
          user_id: currentUser.user_id,
          username: currentUser.username
        })
      });
    } catch (error) {
      console.error('Failed to emit typing indicator:', error);
    }

    // Clear typing state after 3 seconds of no activity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      emitStoppedTyping();
    }, 3000);
  }, [currentUser, selectedConversation, selectedConversationType, selectedChannel, sessionToken, protectedFetch]);

  const emitStoppedTyping = useCallback(async () => {
    if (!currentUser || !selectedConversation || !sessionToken || !isTypingRef.current) return;

    isTypingRef.current = false;

    try {
      await protectedFetch('/api/typing', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: selectedConversation,
          conversation_type: selectedConversationType,
          channel_id: selectedChannel,
          user_id: currentUser.user_id
        })
      });
    } catch (error) {
      console.error('Failed to emit stopped typing indicator:', error);
    }
  }, [currentUser, selectedConversation, selectedConversationType, selectedChannel, sessionToken, protectedFetch]);

  const handleTypingReceived = useCallback((data: TypingData) => {
    // Don't show typing indicator for current user
    if (data.user_id === currentUser?.user_id) return;

    // Only show typing indicators for the current conversation
    const isCurrentConversation = 
      data.conversation_id === selectedConversation &&
      data.conversation_type === selectedConversationType &&
      (!selectedChannel || data.channel_id === selectedChannel);

    if (!isCurrentConversation) return;

    setTypingUsers(prev => {
      // Remove existing typing indicator for this user
      const filtered = prev.filter(typing => typing.user_id !== data.user_id);
      
      // Add new typing indicator
      return [...filtered, { ...data, timestamp: new Date().toISOString() }];
    });
  }, [currentUser?.user_id, selectedConversation, selectedConversationType, selectedChannel]);

  const handleStoppedTyping = useCallback((data: Pick<TypingData, 'user_id' | 'conversation_id' | 'conversation_type' | 'channel_id'>) => {
    setTypingUsers(prev => prev.filter(typing => 
      typing.user_id !== data.user_id ||
      typing.conversation_id !== data.conversation_id ||
      typing.conversation_type !== data.conversation_type ||
      typing.channel_id !== data.channel_id
    ));
  }, []);

  const getTypingUsersForCurrentConversation = useCallback(() => {
    return typingUsers.filter(typing => 
      typing.conversation_id === selectedConversation &&
      typing.conversation_type === selectedConversationType &&
      (!selectedChannel || typing.channel_id === selectedChannel)
    );
  }, [typingUsers, selectedConversation, selectedConversationType, selectedChannel]);

  return {
    typingUsers: getTypingUsersForCurrentConversation(),
    emitTyping,
    emitStoppedTyping,
    handleTypingReceived,
    handleStoppedTyping
  };
};
