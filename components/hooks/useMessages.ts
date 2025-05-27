import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

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
  current_user_read: boolean;
  total_members: number;
  read_count: number;
  read_by_others: boolean;
}

interface Channel {
  channel_id: string;
  group_id: string;
  name: string;
  description: string;
  created_at: string;
  created_by: string;
  is_default: boolean;
  position: number;
}

export const useMessages = (
  currentUser: { user_id: string; username: string } | null,
  selectedConversation: string,
  selectedConversationType: 'direct' | 'group',
  selectedChannel: string,
  groupChannelsParam?: Channel[]
) => {
  const groupChannels: Channel[] = useMemo(() => groupChannelsParam ?? [], [groupChannelsParam]);
  const [messages, setMessages] = useState<(PrivateMessage | GroupMessage)[]>([]);
  const [channelLoading, setChannelLoading] = useState(false);
  const [contextSwitchLoading, setContextSwitchLoading] = useState(false);

  // Refs for managing auto-refresh and session protection
  const sessionIdRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimestampRef = useRef<string>('');
  const failedChannelsRef = useRef<Set<string>>(new Set());
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasMarkedReadRef = useRef<boolean>(false);

  // Fetch messages for selected conversation or channel
  const fetchMessages = useCallback(async (conversationId: string, type: 'direct' | 'group'): Promise<void> => {
    try {
      const currentSessionId = ++sessionIdRef.current;
      console.log(`Starting fetchMessages (session ${currentSessionId}) for conversation:`, conversationId, 'type:', type);
      
      let url: string;
      if (type === 'direct') {
        url = `/api/messages?user_id=${conversationId}`;
      } else {
        if (selectedChannel && groupChannels.length > 0) {
          url = `/api/groups/${conversationId}/channels/${selectedChannel}/messages`;
        } else {
          url = `/api/groups/${conversationId}/messages`;
        }
      }

      console.log('Fetching messages from:', url);
      const res = await fetch(url);
      const data = await res.json();

      // Session protection - only check if this is still the most recent request
      if (sessionIdRef.current !== currentSessionId) {
        console.warn(`Session ${currentSessionId}: Discarding stale fetchMessages response (newer request in progress)`);
        return;
      }

      if (data.success) {
        if (type === 'direct' && data.messages) {
          const filteredMessages = data.messages.filter((msg: PrivateMessage) => 
            msg.sender_id === conversationId || msg.sender_id === currentUser?.user_id
          );
          
          filteredMessages.sort((a: PrivateMessage, b: PrivateMessage) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          
          setMessages(filteredMessages);
        } else if (type === 'group' && data.messages) {
          (data.messages as GroupMessage[]).sort((a: GroupMessage, b: GroupMessage) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          setMessages(data.messages);
        }
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setMessages([]);
      throw err; // Re-throw to allow caller to handle the error
    }
  }, [currentUser?.user_id, selectedChannel, groupChannels]);

  // Fetch messages for selected channel
  const fetchChannelMessages = useCallback(async (groupId: string, channelId: string) => {
    try {
      const currentSessionId = ++sessionIdRef.current;
      console.log(`Starting fetchChannelMessages (session ${currentSessionId}) for channel:`, channelId, 'in group:', groupId);
      
      setChannelLoading(true);
      const url = `/api/groups/${groupId}/channels/${channelId}/messages`;
      const res = await fetch(url);
      const data = await res.json();

      if (res.status === 404 || res.status === 403) {
        console.warn(`Channel not found or access denied (${res.status})`);
        setMessages([]);
        return;
      }

      if (sessionIdRef.current === currentSessionId && 
          selectedConversation === groupId && 
          selectedChannel === channelId && 
          selectedConversationType === 'group') {
        if (data.success && data.messages) {
          (data.messages as GroupMessage[]).sort((a: GroupMessage, b: GroupMessage) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          setMessages(data.messages);
        } else {
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch channel messages:', err);
      if (selectedConversation === groupId && selectedChannel === channelId) {
        setMessages([]);
      }
    } finally {
      setChannelLoading(false);
    }
  }, [selectedConversation, selectedChannel, selectedConversationType]); // Remove groupChannels dependency

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !selectedConversation || !currentUser) return false;

    try {
      let url: string;
      let body: Record<string, unknown>;

      if (selectedConversationType === 'direct') {
        url = '/api/messages';
        body = {
          receiver_id: selectedConversation,
          content: content,
          attachments: []
        };
      } else {
        if (selectedChannel) {
          url = `/api/groups/${selectedConversation}/channels/${selectedChannel}/messages`;
        } else {
          url = `/api/groups/${selectedConversation}/messages`;
        }
        body = {
          content: content,
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
        lastMessageTimestampRef.current = '';
        
        // Refresh messages
        if (selectedConversationType === 'group' && selectedChannel) {
          await fetchChannelMessages(selectedConversation, selectedChannel);
        } else {
          await fetchMessages(selectedConversation, selectedConversationType);
        }
        
        return true;
      } else {
        console.error('Failed to send message:', data);
        return false;
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      return false;
    }
  }, [selectedConversation, selectedConversationType, selectedChannel, currentUser, fetchChannelMessages, fetchMessages]);

  // Auto-refresh effect - DISABLED to prevent excessive API calls
  useEffect(() => {
    // Clear any existing intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Reset state
    lastMessageTimestampRef.current = '';
    failedChannelsRef.current.clear();

    // Auto-refresh is disabled to prevent excessive API requests
    // Messages will be refreshed when:
    // 1. User sends a message
    // 2. User switches conversations/channels
    // 3. Component remounts

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [selectedConversation, selectedConversationType, selectedChannel, currentUser]);

  // Mark as read effect
  useEffect(() => {
    if (!selectedConversation || !currentUser || messages.length === 0) {
      return;
    }

    if (markAsReadTimeoutRef.current) {
      clearTimeout(markAsReadTimeoutRef.current);
      markAsReadTimeoutRef.current = null;
    }
    
    hasMarkedReadRef.current = false;
    
    markAsReadTimeoutRef.current = setTimeout(() => {
      if (hasMarkedReadRef.current) {
        return;
      }
      
      if (selectedConversationType === 'direct') {
        const unreadMessages = messages
          .filter((msg): msg is PrivateMessage => (msg as PrivateMessage).receiver_id !== undefined && (msg as PrivateMessage).read !== undefined)
          .filter(msg => msg.sender_id === selectedConversation && msg.receiver_id === currentUser.user_id && !msg.read);
        
        if (unreadMessages.length > 0) {
          hasMarkedReadRef.current = true;
          
          fetch('/api/messages', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender_id: selectedConversation }),
          }).then((res) => {
            if (res.ok) {
              fetchMessages(selectedConversation, selectedConversationType);
            } else {
              hasMarkedReadRef.current = false;
            }
          }).catch(() => {
            hasMarkedReadRef.current = false;
          });
        }
      } else if (selectedConversationType === 'group') {
        const unreadMessages = messages
          .filter((msg): msg is GroupMessage => (msg as GroupMessage).group_id !== undefined)
          .filter(msg => !msg.current_user_read && msg.sender_id !== currentUser.user_id);
        
        if (unreadMessages.length > 0) {
          hasMarkedReadRef.current = true;
          
          fetch(`/api/groups/${selectedConversation}/messages/read`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
          }).then((res) => {
            if (res.ok) {
              fetchMessages(selectedConversation, selectedConversationType);
            } else {
              hasMarkedReadRef.current = false;
            }
          }).catch(() => {
            hasMarkedReadRef.current = false;
          });
        }
      }
    }, 2000);
    
    return () => {
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
        markAsReadTimeoutRef.current = null;
      }
    };
  }, [selectedConversation, selectedConversationType, currentUser, messages]); // Remove markAsRead dependency and inline the logic

  // Clear messages when conversation changes
  useEffect(() => {
    setMessages([]);
    hasMarkedReadRef.current = false;
  }, [selectedConversation, selectedConversationType, selectedChannel]);

  // Delete a message (direct or group)
  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      if (selectedConversationType === 'direct') {
        // Private message
        const response = await fetch('/api/messages', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_id: messageId })
        });
        const data = await response.json();
        if (data.success) {
          await fetchMessages(selectedConversation, selectedConversationType);
          return true;
        }
        return false;
      } else if (selectedConversationType === 'group') {
        // Group message - use correct endpoint based on whether we're in a channel
        let deleteUrl: string;
        if (selectedChannel) {
          // Channel-specific message
          deleteUrl = `/api/groups/${selectedConversation}/channels/${selectedChannel}/messages`;
        } else {
          // General group message
          deleteUrl = `/api/groups/${selectedConversation}/messages`;
        }
        
        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_id: messageId })
        });
        const data = await response.json();
        if (data.success) {
          // Refresh messages using the appropriate fetch method
          if (selectedChannel) {
            await fetchChannelMessages(selectedConversation, selectedChannel);
          } else {
            await fetchMessages(selectedConversation, selectedConversationType);
          }
          return true;
        }
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  }, [selectedConversation, selectedConversationType, selectedChannel, fetchMessages, fetchChannelMessages]);

  return {
    messages,
    setMessages,
    channelLoading,
    contextSwitchLoading,
    setContextSwitchLoading,
    fetchMessages,
    fetchChannelMessages,
    sendMessage,
    deleteMessage
  };
};