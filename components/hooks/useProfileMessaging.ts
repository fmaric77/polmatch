import { useState, useCallback, useEffect } from 'react';
import { useCSRFToken } from './useCSRFToken';

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
  sender_profile_data?: {
    display_name: string;
    profile_picture_url: string;
  };
  reply_to?: {
    message_id: string;
    content: string;
    sender_name: string;
  };
}

interface ProfileConversation {
  id: string;
  participant_ids: string[];
  other_user: {
    user_id: string;
    username: string;
    display_name?: string;
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
  const { protectedFetch } = useCSRFToken();
  const [messages, setMessages] = useState<ProfileMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Comprehensive deduplication function for profile messages
  const deduplicateMessages = useCallback((messageList: ProfileMessage[]): ProfileMessage[] => {
    const seen = new Set<string>();
    const deduplicated: ProfileMessage[] = [];
    
    for (const message of messageList) {
      let uniqueId: string;
      
      if (message._id) {
        uniqueId = `profile-${message._id}`;
      } else {
        // Fallback: create unique ID from content and timestamp
        uniqueId = `fallback-${message.sender_id}-${message.receiver_id}-${message.timestamp}-${message.content.substring(0, 20)}`;
      }
      
      if (!seen.has(uniqueId)) {
        seen.add(uniqueId);
        deduplicated.push(message);
      } else {
        console.log('🚫 Duplicate profile message detected and removed:', uniqueId);
      }
    }
    
    return deduplicated;
  }, []);

  const fetchMessages = useCallback(async (otherUserId: string): Promise<void> => {
    try {
      // Clear messages at the start of fetch to avoid showing stale data
      setMessages([]);
      setLoading(true);
      setError('');

      console.log(`Fetching ${profileType} messages for user:`, otherUserId);
      const response = await fetch(`/api/messages?other_user_id=${otherUserId}&sender_profile_type=${profileType}&receiver_profile_type=${profileType}`);
      const data = await response.json();

      if (data.success) {
        console.log(`Fetched ${data.messages?.length || 0} ${profileType} messages`);
        const sortedMessages = (data.messages || []).sort((a: ProfileMessage, b: ProfileMessage) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        setMessages(deduplicateMessages(sortedMessages));
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

  const sendMessage = useCallback(async (receiverId: string, content: string, replyTo?: { id: string; content: string; sender_name: string }): Promise<boolean> => {
    try {
      const requestBody: Record<string, unknown> = {
        receiver_id: receiverId,
        content,
        sender_profile_type: profileType,
        receiver_profile_type: profileType,
        attachments: []
      };

      // Add reply_to information if provided
      if (replyTo) {
        requestBody.reply_to = {
          message_id: replyTo.id,
          content: replyTo.content,
          sender_name: replyTo.sender_name
        };
      }

      const response = await protectedFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (data.success) {
        // Add the new message to the current messages
        if (data.message) {
          setMessages(prevMessages => {
            const newMessage = { ...data.message, profile_type: profileType };
            const updatedMessages = [...prevMessages, newMessage];
            const sortedMessages = updatedMessages.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
            return deduplicateMessages(sortedMessages);
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
  }, [profileType, protectedFetch, deduplicateMessages]);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      const response = await protectedFetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          sender_profile_type: profileType,
          receiver_profile_type: profileType
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Remove the deleted message from local state
        setMessages(prevMessages => 
          prevMessages.filter(msg => msg._id !== messageId)
        );
        return true;
      } else {
        setError(data.message || 'Failed to delete message');
        return false;
      }
    } catch (err) {
      console.error('Error deleting profile message:', err);
      setError('Failed to delete message');
      return false;
    }
  }, [profileType, protectedFetch]);

  // Safe setMessages that always deduplicates
  const setMessagesSafe = useCallback((updater: (prev: ProfileMessage[]) => ProfileMessage[]) => {
    setMessages(prev => {
      const updated = updater(prev);
      return deduplicateMessages(updated);
    });
  }, [deduplicateMessages]);

  return {
    messages,
    setMessages: setMessagesSafe,
    loading,
    error,
    fetchMessages,
    sendMessage,
    deleteMessage
  };
};

export const useProfileConversations = (profileType: 'basic' | 'love' | 'business') => {
  const { protectedFetch } = useCSRFToken();
  const [conversations, setConversations] = useState<ProfileConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Clear conversations when profile type changes
  useEffect(() => {
    console.log(`Profile type changed to: ${profileType}, clearing conversations`);
    setConversations([]);
    setError('');
  }, [profileType]);

  const fetchConversations = useCallback(async (): Promise<void> => {
    try {
      // Clear conversations at start of fetch to avoid showing stale data
      setConversations([]);
      setLoading(true);
      setError('');

      const response = await fetch(`/api/private-conversations?profile_type=${profileType}`);
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

  const deleteConversation = useCallback(async (otherUserId: string): Promise<boolean> => {
    try {
      const response = await protectedFetch('/api/private-conversations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          other_user_id: otherUserId,
          sender_profile_type: profileType,
          receiver_profile_type: profileType // For profile-specific deletion
        })
      });

      if (response.ok) {
        // Remove the conversation from local state
        setConversations(prev => prev.filter(conv => conv.other_user.user_id !== otherUserId));
        return true;
      } else {
        const errorText = await response.text();
        console.error('Failed to delete profile conversation:', errorText);
        setError('Failed to delete conversation');
        return false;
      }
    } catch (err) {
      console.error('Error deleting profile conversation:', err);
      setError('Failed to delete conversation');
      return false;
    }
  }, [profileType, protectedFetch]);

  return {
    conversations,
    setConversations,
    loading,
    error,
    fetchConversations,
    deleteConversation
  };
};
