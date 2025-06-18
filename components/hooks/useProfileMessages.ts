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

  // Refs for managing auto-refresh and stable references
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);
  const currentUserRef = useRef(currentUser);
  const otherUserIdRef = useRef(otherUserId);
  const profileTypeRef = useRef(profileType);

  // Update refs when props change
  useEffect(() => {
    currentUserRef.current = currentUser;
    otherUserIdRef.current = otherUserId;
    profileTypeRef.current = profileType;
  }, [currentUser, otherUserId, profileType]);

  const fetchMessages = useCallback(async () => {
    const user = currentUserRef.current;
    const otherId = otherUserIdRef.current;
    const pType = profileTypeRef.current;

    if (!user || !otherId || !pType) {
      setMessages([]);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        other_user_id: otherId,
        profile_type: pType,
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
  }, []); // No dependencies - uses refs instead

  const sendMessage = useCallback(async (content: string, replyTo?: { id: string; content: string; sender_name: string }): Promise<boolean> => {
    const user = currentUserRef.current;
    const otherId = otherUserIdRef.current;
    const pType = profileTypeRef.current;

    if (!user || !otherId || !content.trim() || !pType) {
      return false;
    }

    try {
      setSending(true);
      setError('');

      const requestBody: Record<string, unknown> = {
        receiver_id: otherId,
        content: content.trim(),
        profile_type: pType
      };

      // Add reply_to information if provided
      if (replyTo) {
        requestBody.reply_to = {
          message_id: replyTo.id,
          content: replyTo.content,
          sender_name: replyTo.sender_name
        };
      }

      const res = await fetch('/api/messages/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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
  }, [fetchMessages]); // Only fetchMessages as dependency since it's now stable

  const markAsRead = useCallback(async () => {
    const user = currentUserRef.current;
    const otherId = otherUserIdRef.current;
    const pType = profileTypeRef.current;

    if (!user || !otherId || !pType) {
      return;
    }

    try {
      const res = await fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          other_user_id: otherId,
          profile_type: pType
        }),
      });

      if (res.ok) {
        // Update local messages to mark as read using functional update
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.receiver_id === user.user_id 
              ? { ...msg, read: true }
              : msg
          )
        );
      }
    } catch (err) {
      console.error('Error marking profile messages as read:', err);
    }
  }, []); // No dependencies - uses refs instead

  // Auto-refresh messages every 5 seconds when active
  useEffect(() => {
    const user = currentUserRef.current;
    const otherId = otherUserIdRef.current;
    const pType = profileTypeRef.current;

    if (!isActiveRef.current || !user || !otherId || !pType) {
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
  }, [currentUser, otherUserId, profileType, fetchMessages]); // These dependencies are needed to restart when conversation changes

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
    const user = currentUserRef.current;
    const otherId = otherUserIdRef.current;
    const pType = profileTypeRef.current;

    if (user && otherId && pType && messages.length > 0) {
      const unreadMessages = messages.filter(
        msg => msg.receiver_id === user.user_id && !msg.read
      );
      
      if (unreadMessages.length > 0) {
        markAsRead();
      }
    }
  }, [messages, markAsRead]); // Only depend on messages and markAsRead (which is now stable)

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
