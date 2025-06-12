import { useState, useCallback, useRef, useEffect } from 'react';

type ProfileType = 'basic' | 'love' | 'business';

interface ProfileMessage {
  _id?: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  encrypted_content?: string;
  timestamp: string;
  read: boolean;
  attachments: string[];
  profile_type: ProfileType;
  sender_profile_data: {
    display_name: string;
    profile_picture_url: string;
  };
}

export const useProfileMessages = (
  currentUser: { user_id: string; username: string } | null,
  otherUserId: string,
  profileType: ProfileType
) => {
  const [messages, setMessages] = useState<ProfileMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  // Refs for managing auto-refresh
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  const fetchMessages = useCallback(async () => {
    if (!currentUser || !otherUserId || !profileType) {
      setMessages([]);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        other_user_id: otherUserId,
        profile_type: profileType,
        limit: '50'
      });

      const res = await fetch(`/api/messages/profile?${params}`);
      const data = await res.json();

      if (data.success) {
        setMessages(data.messages || []);
      } else {
        console.error('Failed to fetch profile messages:', data.message);
        setError(data.message || 'Failed to fetch messages');
        setMessages([]);
      }
    } catch (err) {
      console.error('Error fetching profile messages:', err);
      setError('Failed to fetch messages');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, otherUserId, profileType]);

  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!currentUser || !otherUserId || !content.trim() || !profileType) {
      return false;
    }

    try {
      setSending(true);
      setError('');

      const res = await fetch('/api/messages/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiver_id: otherUserId,
          content: content.trim(),
          profile_type: profileType
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Refresh messages to get the new message
        await fetchMessages();
        return true;
      } else {
        console.error('Failed to send profile message:', data.message);
        setError(data.message || 'Failed to send message');
        return false;
      }
    } catch (err) {
      console.error('Error sending profile message:', err);
      setError('Failed to send message');
      return false;
    } finally {
      setSending(false);
    }
  }, [currentUser, otherUserId, profileType, fetchMessages]);

  const markAsRead = useCallback(async () => {
    if (!currentUser || !otherUserId || !profileType) {
      return;
    }

    try {
      const res = await fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          other_user_id: otherUserId,
          profile_type: profileType
        }),
      });

      if (res.ok) {
        // Update local messages to mark as read
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.receiver_id === currentUser.user_id 
              ? { ...msg, read: true }
              : msg
          )
        );
      }
    } catch (err) {
      console.error('Error marking profile messages as read:', err);
    }
  }, [currentUser, otherUserId, profileType]);

  // Auto-refresh messages every 5 seconds when active
  useEffect(() => {
    if (!isActiveRef.current || !currentUser || !otherUserId || !profileType) {
      return;
    }

    const startAutoRefresh = () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      
      refreshTimerRef.current = setInterval(() => {
        if (isActiveRef.current) {
          fetchMessages();
        }
      }, 5000);
    };

    // Initial fetch
    fetchMessages();
    
    // Start auto-refresh
    startAutoRefresh();

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [fetchMessages]);

  // Handle component unmounting or becoming inactive
  useEffect(() => {
    isActiveRef.current = true;
    return () => {
      isActiveRef.current = false;
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, []);

  // Mark messages as read when conversation becomes active
  useEffect(() => {
    if (currentUser && otherUserId && profileType && messages.length > 0) {
      const unreadMessages = messages.filter(
        msg => msg.receiver_id === currentUser.user_id && !msg.read
      );
      
      if (unreadMessages.length > 0) {
        markAsRead();
      }
    }
  }, [currentUser, otherUserId, profileType, messages, markAsRead]);

  return {
    messages,
    loading,
    error,
    sending,
    sendMessage,
    fetchMessages,
    markAsRead,
    setMessages
  };
};
