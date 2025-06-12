import { useState, useRef, useCallback } from 'react';

interface PrivateMessage {
  _id?: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachments: string[];
}

interface GroupMessage {
  message_id: string;
  group_id: string;
  channel_id?: string;
  sender_id: string;
  content: string;
  timestamp: string;
  attachments: string[];
  sender_username: string;
  sender_display_name?: string;
  current_user_read: boolean;
  total_members: number;
  read_count: number;
  read_by_others: boolean;
}

export const useMessaging = () => {
  const [selectedConversation, setSelectedConversation] = useState<string>('');
  const [messages, setMessages] = useState<(PrivateMessage | GroupMessage)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<number>(0);
  const lastMessageTimestampRef = useRef<string>('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = useCallback(async (conversationId: string, type: 'direct' | 'group', selectedChannel?: string) => {
    try {
      setLoading(true);
      const currentSessionId = ++sessionIdRef.current;
      
      let url: string;
      if (type === 'direct') {
        url = `/api/messages?user_id=${conversationId}`;
      } else {
        url = selectedChannel 
          ? `/api/groups/${conversationId}/channels/${selectedChannel}/messages`
          : `/api/groups/${conversationId}/messages`;
      }

      const res = await fetch(url);
      const data = await res.json();
      
      if (sessionIdRef.current !== currentSessionId) {
        return; // Prevent race conditions
      }

      if (data.success) {
        const sortedMessages = data.messages.sort((a: PrivateMessage | GroupMessage, b: PrivateMessage | GroupMessage) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        setMessages(sortedMessages);
        
        if (sortedMessages.length > 0) {
          lastMessageTimestampRef.current = sortedMessages[sortedMessages.length - 1].timestamp;
        }
      }
    } catch {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (
    conversationId: string, 
    type: 'direct' | 'group', 
    selectedChannel?: string,
    content?: string
  ): Promise<boolean> => {
    const messageContent = content || newMessage;
    if (!messageContent.trim()) return false;

    try {
      let url: string;
      let body: Record<string, unknown>;

      if (type === 'direct') {
        url = '/api/messages';
        body = {
          receiver_id: conversationId,
          content: messageContent,
          attachments: []
        };
      } else {
        url = selectedChannel 
          ? `/api/groups/${conversationId}/channels/${selectedChannel}/messages`
          : `/api/groups/${conversationId}/messages`;
        body = {
          content: messageContent,
          attachments: []
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      if (data.success) {
        if (!content) setNewMessage(''); // Only clear if using internal state
        lastMessageTimestampRef.current = '';
        await fetchMessages(conversationId, type, selectedChannel);
        return true;
      } else {
        setError(data.error || 'Failed to send message');
        return false;
      }
    } catch {
      setError('Failed to send message');
      return false;
    }
  }, [newMessage, fetchMessages]);

  const markAsRead = useCallback((conversationId: string, conversationType: 'direct' | 'group') => {
    // Implementation for marking messages as read
    console.log('Marking as read:', conversationId, conversationType);
  }, []);

  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      // Implementation for deleting messages
      console.log('Deleting message:', messageId);
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    selectedConversation,
    setSelectedConversation,
    messages,
    setMessages,
    loading,
    setLoading,
    error,
    setError,
    newMessage,
    setNewMessage,
    messagesEndRef,
    scrollToBottom,
    fetchMessages,
    sendMessage,
    sessionIdRef,
    lastMessageTimestampRef,
    markAsRead,
    deleteMessage
  };
};