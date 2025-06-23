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
  _id?: string; // MongoDB ObjectId for channel messages
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
  is_pinned?: boolean;
  pinned_at?: string;
  pinned_by?: string;
  message_type?: 'text' | 'poll';
  poll_data?: {
    poll_id: string;
    question: string;
    options: Array<{
      option_id: string;
      text: string;
    }>;
    expires_at?: string;
  };
  reply_to?: {
    message_id: string;
    content: string;
    sender_name: string;
  };
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
  currentUser: { user_id: string; username: string; display_name?: string } | null,
  selectedConversation: string,
  selectedConversationType: 'direct' | 'group',
  selectedChannel: string,
  groupChannelsParam?: Channel[],
  profileType?: string
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

  // Comprehensive deduplication function
  const deduplicateMessages = useCallback((messageList: (PrivateMessage | GroupMessage)[]): (PrivateMessage | GroupMessage)[] => {
    const seen = new Set<string>();
    const deduplicated: (PrivateMessage | GroupMessage)[] = [];
    
    for (const message of messageList) {
      // Create a unique identifier for each message
      const privateMsg = message as PrivateMessage;
      const groupMsg = message as GroupMessage;
      
      let uniqueId: string;
      
      if (privateMsg._id) {
        uniqueId = `private-${privateMsg._id}`;
      } else if (groupMsg.message_id) {
        uniqueId = `group-${groupMsg.message_id}`;
      } else {
        // Fallback: create unique ID from content and timestamp
        uniqueId = `fallback-${message.sender_id}-${message.timestamp}-${message.content.substring(0, 20)}`;
      }
      
      if (!seen.has(uniqueId)) {
        seen.add(uniqueId);
        deduplicated.push(message);
      } else {
        console.log('🚫 Duplicate message detected and removed:', uniqueId);
      }
    }
    
    return deduplicated;
  }, []);

  // Fetch messages for selected conversation or channel
  const fetchMessages = useCallback(async (conversationId: string, type: 'direct' | 'group'): Promise<void> => {
    try {
      const currentSessionId = ++sessionIdRef.current;
      console.log(`Starting fetchMessages (session ${currentSessionId}) for conversation:`, conversationId, 'type:', type);
      
      let url: string;
      if (type === 'direct') {
        url = `/api/messages?user_id=${conversationId}`;
      } else {
        const profileParam = profileType ? `?profile_type=${profileType}` : '';
        if (selectedChannel && groupChannels.length > 0) {
          url = `/api/groups/${conversationId}/channels/${selectedChannel}/messages${profileParam}`;
        } else {
          url = `/api/groups/${conversationId}/messages${profileParam}`;
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
          
          setMessages(deduplicateMessages(filteredMessages));
        } else if (type === 'group' && data.messages) {
          console.log('🔍 Raw group messages from API:', data.messages.slice(0, 2).map((msg: GroupMessage) => ({
            message_id: msg.message_id,
            sender_id: msg.sender_id,
            content_preview: msg.content?.substring(0, 30)
          })));
          
          (data.messages as GroupMessage[]).sort((a: GroupMessage, b: GroupMessage) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          setMessages(deduplicateMessages(data.messages));
        }
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setMessages([]);
      throw err; // Re-throw to allow caller to handle the error
    }
  }, [currentUser?.user_id, selectedChannel, groupChannels, profileType]);

  // Fetch messages for selected channel
  const fetchChannelMessages = useCallback(async (groupId: string, channelId: string) => {
    try {
      const currentSessionId = ++sessionIdRef.current;
      console.log(`Starting fetchChannelMessages (session ${currentSessionId}) for channel:`, channelId, 'in group:', groupId);
      
      setChannelLoading(true);
      const profileParam = profileType ? `?profile_type=${profileType}` : '';
      const url = `/api/groups/${groupId}/channels/${channelId}/messages${profileParam}`;
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
  }, [selectedConversation, selectedChannel, selectedConversationType, profileType]); // Remove groupChannels dependency

  const sendMessage = useCallback(async (content: string, replyTo?: { id: string; content: string; sender_name: string }) => {
    if (!content.trim() || !selectedConversation || !currentUser) return false;

    try {
      let url: string;
      let body: Record<string, unknown>;

      if (selectedConversationType === 'direct') {
        url = '/api/messages';
        body = {
          receiver_id: selectedConversation,
          content: content,
          attachments: [],
          ...(replyTo && { 
            reply_to: {
              message_id: replyTo.id,
              content: replyTo.content,
              sender_name: replyTo.sender_name
            }
          })
        };
      } else {
        if (selectedChannel) {
          url = `/api/groups/${selectedConversation}/channels/${selectedChannel}/messages`;
        } else {
          url = `/api/groups/${selectedConversation}/messages`;
        }
        body = {
          content: content,
          attachments: [],
          ...(profileType && { profile_type: profileType }),
          ...(replyTo && { 
            reply_to: {
              message_id: replyTo.id,
              content: replyTo.content,
              sender_name: replyTo.sender_name
            }
          })
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
        
        // Add optimistic update for direct messages
        if (selectedConversationType === 'direct' && data.message) {
          setMessages(prevMessages => {
            const newMessage = data.message;
            
            // For direct messages, ensure we have the required fields
            if (newMessage.is_read !== undefined) {
              newMessage.read = newMessage.is_read;
            }
            // Ensure we have a proper _id for direct messages
            if (!newMessage._id && newMessage.message_id) {
              newMessage._id = newMessage.message_id;
            }
            
            // Sort messages by timestamp to maintain order
            const updatedMessages = [...prevMessages, newMessage];
            return updatedMessages.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        }
        
        // Add optimistic update for group messages (sender only)
        // SSE will handle updates for other group members
        if (selectedConversationType === 'group' && data.message) {
          const newGroupMessage = {
            _id: data.message._id,
            message_id: data.message.message_id,
            group_id: data.message.group_id,
            channel_id: data.message.channel_id || '',
            sender_id: currentUser.user_id,
            content: content, // Use the original content, not encrypted
            timestamp: data.message.timestamp,
            attachments: data.message.attachments || [],
            sender_username: currentUser.username,
            sender_display_name: currentUser.display_name,
            current_user_read: true, // Sender has read their own message
            total_members: 0, // Will be updated via SSE
            read_count: 1, // Only sender has read it initially
            read_by_others: false,
            ...(replyTo && {
              reply_to: {
                message_id: replyTo.id,
                content: replyTo.content,
                sender_name: replyTo.sender_name
              }
            })
          };
          
          setMessages(prevMessages => {
            console.log('Adding optimistic group message for sender:', newGroupMessage.message_id);
            
            // Check for duplicates using message_id
            const messageExists = prevMessages.some(msg => {
              if ('message_id' in msg) {
                return (msg as GroupMessage).message_id === newGroupMessage.message_id;
              }
              return false;
            });
            
            if (messageExists) {
              console.log('Group message already exists, skipping optimistic update');
              return prevMessages;
            }
            
            const updatedMessages = [...prevMessages, newGroupMessage];
            return updatedMessages.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
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
  }, [selectedConversation, selectedConversationType, selectedChannel, currentUser, profileType]);

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
              // Update read status locally instead of refetching
              setMessages(prevMessages => 
                prevMessages.map(msg => {
                  if ('receiver_id' in msg && msg.sender_id === selectedConversation && msg.receiver_id === currentUser.user_id) {
                    return { ...msg, read: true };
                  }
                  return msg;
                })
              );
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
            body: JSON.stringify({
              ...(profileType && { profile_type: profileType })
            })
          }).then((res) => {
            if (res.ok) {
              // Update read status locally instead of refetching
              setMessages(prevMessages => 
                prevMessages.map(msg => {
                  if ('group_id' in msg && msg.sender_id !== currentUser.user_id) {
                    return { ...msg, current_user_read: true };
                  }
                  return msg;
                })
              );
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
  }, [selectedConversation, selectedConversationType, currentUser, messages]); // Removed fetchMessages to prevent infinite loops

  // Clear messages when conversation changes
  useEffect(() => {
    setMessages([]);
    hasMarkedReadRef.current = false;
  }, [selectedConversation, selectedConversationType, selectedChannel]);

  // Delete a message (direct or group)
  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      if (selectedConversationType === 'direct') {
        // Private message - use _id field
        const response = await fetch('/api/messages', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_id: messageId })
        });
        
        if (!response.ok) {
          console.error('Failed to delete direct message - HTTP error:', response.status, response.statusText);
          return false;
        }
        
        const data = await response.json();
        if (data.success) {
          await fetchMessages(selectedConversation, selectedConversationType);
          return true;
        }
        console.error('Failed to delete direct message:', data?.message || data?.error || 'Unknown error', data);
        return false;
      } else if (selectedConversationType === 'group') {
        // Group message - find the message to get the correct ID
        const messageToDelete = messages.find(msg => {
          if ('message_id' in msg) {
            return msg.message_id === messageId;
          }
          return false;
        }) as GroupMessage | undefined;

        if (!messageToDelete) {
          console.error('Message not found in current messages');
          return false;
        }

        let deleteUrl: string;
        let requestBody: Record<string, unknown>;
        
        if (selectedChannel) {
          // Channel-specific message deletion
          deleteUrl = `/api/groups/${selectedConversation}/channels/${selectedChannel}/messages`;
          
          // For channel messages, we need to use the MongoDB _id if available, 
          // otherwise use message_id but it might fail if it's not a valid ObjectId
          const messageIdForChannel = ('_id' in messageToDelete && messageToDelete._id) 
            ? messageToDelete._id 
            : messageToDelete.message_id;
            
          requestBody = { 
            messageId: messageIdForChannel,
            ...(profileType && { profile_type: profileType })
          };
        } else {
          // General group message deletion
          deleteUrl = `/api/groups/${selectedConversation}/messages`;
          requestBody = { 
            message_id: messageToDelete.message_id, // Use message_id directly for group endpoint
            ...(profileType && { profile_type: profileType })
          };
        }
        
        console.log('🗑️ Delete request:', { 
          deleteUrl, 
          requestBody, 
          messageToDelete: {
            message_id: messageToDelete.message_id,
            _id: ('_id' in messageToDelete) ? messageToDelete._id : 'not present',
            sender_id: messageToDelete.sender_id
          }
        });
        
        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          console.error('Failed to delete group message - HTTP error:', response.status, response.statusText);
          try {
            const errorText = await response.text();
            console.error('Error response body:', errorText);
          } catch (e) {
            console.error('Could not read error response body:', e);
          }
          return false;
        }
        
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
        console.error('Failed to delete group message:', data?.message || data?.error || 'Unknown error', data);
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  }, [selectedConversation, selectedConversationType, selectedChannel, fetchMessages, fetchChannelMessages, profileType, messages]);

  // Pin a message
  const pinMessage = useCallback(async (messageId: string, channelId?: string): Promise<boolean> => {
    try {
      if (selectedConversationType !== 'group') {
        console.error('Pin message only available for group messages');
        return false;
      }

      console.log('🔍 Pinning message:', { 
        messageId, 
        channelId, 
        selectedConversation, 
        selectedChannel,
        selectedConversationType 
      });

      const requestBody = { 
        message_id: messageId,
        channel_id: channelId || selectedChannel
      };

      console.log('📤 Pin request body:', requestBody);

      const response = await fetch(`/api/groups/${selectedConversation}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Pin response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to pin message - HTTP error:', response.status, response.statusText);
        console.error('Error response body:', errorText);
        return false;
      }

      const data = await response.json();
      console.log('📥 Pin response data:', data);
      
      if (data.success) {
        // Refresh messages to update the pinned status
        if (selectedChannel) {
          await fetchChannelMessages(selectedConversation, selectedChannel);
        } else {
          await fetchMessages(selectedConversation, selectedConversationType);
        }
        return true;
      }
      console.error('Failed to pin message:', data?.error || 'Unknown error', data);
      return false;
    } catch (error) {
      console.error('Error pinning message:', error);
      return false;
    }
  }, [selectedConversation, selectedConversationType, selectedChannel, fetchMessages, fetchChannelMessages]);

  // Unpin a message
  const unpinMessage = useCallback(async (messageId: string, channelId?: string): Promise<boolean> => {
    try {
      if (selectedConversationType !== 'group') {
        console.error('Unpin message only available for group messages');
        return false;
      }

      const response = await fetch(`/api/groups/${selectedConversation}/pin`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message_id: messageId,
          channel_id: channelId
        })
      });

      if (!response.ok) {
        console.error('Failed to unpin message - HTTP error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        return false;
      }

      const data = await response.json();
      
      if (data.success) {
        // Refresh messages to update the pinned status
        if (selectedChannel) {
          await fetchChannelMessages(selectedConversation, selectedChannel);
        } else {
          await fetchMessages(selectedConversation, selectedConversationType);
        }
        return true;
      }
      console.error('Failed to unpin message:', data?.error || 'Unknown error', data);
      return false;
    } catch (error) {
      console.error('Error unpinning message:', error);
      return false;
    }
  }, [selectedConversation, selectedConversationType, selectedChannel, fetchMessages, fetchChannelMessages]);

  // Safe setMessages that always deduplicates
  const setMessagesSafe = useCallback((updater: (prev: (PrivateMessage | GroupMessage)[]) => (PrivateMessage | GroupMessage)[]) => {
    setMessages(prev => {
      const updated = updater(prev);
      return deduplicateMessages(updated);
    });
  }, [deduplicateMessages]);

  return {
    messages,
    setMessages: setMessagesSafe,
    channelLoading,
    contextSwitchLoading,
    setContextSwitchLoading,
    fetchMessages,
    fetchChannelMessages,
    sendMessage,
    deleteMessage,
    pinMessage,
    unpinMessage
  };
};