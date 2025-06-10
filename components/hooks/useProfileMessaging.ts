import { useState, useCallback } from 'react';

export interface ProfileMessage {
  _id?: string;
  conversation_id?: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachments: string[];
  profile_type: 'basic' | 'love' | 'business';
}

interface ProfileConversation {
  id: string;
  participant_ids: string[];
  other_user: {
    user_id: string;
    username: string;
    first_name?: string;
    last_name?: string;
    profile_picture?: string;
  };
  created_at: Date;
  updated_at: Date;
  latest_message?: {
    content: string;
    timestamp: string;
    sender_id: string;
  };
  profile_type: 'basic' | 'love' | 'business';
}

export const useProfileMessages = (profileType: 'basic' | 'love' | 'business') => {
  const [messages, setMessages] = useState<ProfileMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMessages = useCallback(async (otherUserId: string): Promise<void> => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/friends/profile/messages?user_id=${otherUserId}&profile_type=${profileType}`);
      const data = await response.json();

      if (data.success) {
        setMessages(data.messages || []);
      } else {
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
  }, [profileType]);

  const sendMessage = useCallback(async (receiverId: string, content: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/friends/profile/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: receiverId,
          content,
          profile_type: profileType,
          attachments: []
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Add the new message to the current messages
        if (data.message) {
          setMessages(prevMessages => {
            const newMessage = { ...data.message, profile_type: profileType };
            const updatedMessages = [...prevMessages, newMessage];
            return updatedMessages.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        }
        return true;
      } else {
        setError(data.message || 'Failed to send message');
        return false;
      }
    } catch (err) {
      console.error('Error sending profile message:', err);
      setError('Failed to send message');
      return false;
    }
  }, [profileType]);

  return {
    messages,
    setMessages,
    loading,
    error,
    fetchMessages,
    sendMessage
  };
};

export const useProfileConversations = (profileType: 'basic' | 'love' | 'business') => {
  const [conversations, setConversations] = useState<ProfileConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchConversations = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/friends/profile/conversations?profile_type=${profileType}`);
      const data = await response.json();

      if (data.success) {
        setConversations(data.conversations || []);
      } else {
        setError(data.message || 'Failed to fetch conversations');
        setConversations([]);
      }
    } catch (err) {
      console.error('Error fetching profile conversations:', err);
      setError('Failed to fetch conversations');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [profileType]);

  return {
    conversations,
    setConversations,
    loading,
    error,
    fetchConversations
  };
};
