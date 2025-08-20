import React, { useEffect, useState, useRef } from 'react';
import ProfileAvatar from './ProfileAvatar';
import { useSSE } from './providers/SSEProvider';
import { useTypingIndicator } from './hooks/useTypingIndicator';
import TypingIndicator from './TypingIndicator';
import { getAnonymousDisplayName } from '../lib/anonymization';
import { useCSRFToken } from './hooks/useCSRFToken';
import type { NewMessageData, NewConversationData } from './hooks/useWebSocket';
//d
interface Message {
  _id?: string;
  conversation_id?: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachments: string[];
  reply_to?: {
    message_id: string;
    content: string;
    sender_name: string;
  };
}

interface User {
  user_id: string;
  username: string;
  display_name?: string;
}

interface Conversation {
  conversation_id: string;
  other_user: {
    user_id: string;
    username: string;
  };
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

const Messages = () => {
  console.log('=== MESSAGES COMPONENT STARTING ===');
  console.error('=== MESSAGES COMPONENT ERROR LOG TEST ===');
  alert('Messages component is rendering!');
  const { protectedFetch } = useCSRFToken();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  // Mention suggestion state
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [refresh, setRefresh] = useState(0);
  // currentUser is now provided by SSEProvider
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoDeleteDays, setAutoDeleteDays] = useState('');
  const [conversations, setConversations] = useState<User[]>([]);
  // sessionToken is now provided by SSEProvider
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // SSE connection for real-time messaging
  const { 
    isConnected, 
    connectionError, 
    sessionToken, 
    currentUser,
    setMessageHandler,
    setConversationHandler,
    setTypingStartHandler,
    setTypingStopHandler
  } = useSSE();

  // Typing indicator hook
  const typingIndicator = useTypingIndicator({
    currentUser,
    selectedConversation: selectedUser,
    selectedConversationType: 'direct',
    sessionToken
  });

  // Debug session token changes
  useEffect(() => {
    console.log('Session token changed:', sessionToken ? sessionToken.substring(0, 10) + '...' : 'null');
  }, [sessionToken]);

  // Register SSE handlers for real-time updates
  useEffect(() => {
    // Register message handler
    setMessageHandler((data: NewMessageData) => {
      console.log('Received new message via SSE:', data);
      
      // If this message is for the current conversation, add it to messages
      if (selectedUser && 
          ((data.sender_id === selectedUser && data.receiver_id === currentUser?.user_id) ||
           (data.sender_id === currentUser?.user_id && data.receiver_id === selectedUser))) {
        
        const newMessage: Message = {
          _id: data.message_id,
          sender_id: data.sender_id,
          receiver_id: data.receiver_id,
          content: data.content,
          timestamp: data.timestamp,
          read: false,
          attachments: [],
          ...(data.reply_to && { reply_to: data.reply_to })
        };
        
        setMessages(prevMessages => {
          // Check if message already exists to prevent duplicates
          const messageExists = prevMessages.some(msg => msg._id === newMessage._id);
          if (messageExists) return prevMessages;
          
          // Add new message and sort by timestamp
          const updatedMessages = [...prevMessages, newMessage];
          return updatedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        });
      }
      
      // Refresh conversations list to update last message/unread count
      setRefresh(r => r + 1);
    });

    // Register conversation handler
    setConversationHandler((data: NewConversationData) => {
      console.log('Received new conversation via SSE:', data);
      
      // If this involves the current user, refresh conversations
      if (currentUser && data.participants.includes(currentUser.user_id)) {
        setRefresh(r => r + 1);
      }
    });

    // Register typing handlers
    setTypingStartHandler((data) => {
      console.log('Received typing start via SSE:', data);
      typingIndicator.handleTypingReceived(data);
    });

    setTypingStopHandler((data) => {
      console.log('Received typing stop via SSE:', data);
      typingIndicator.handleStoppedTyping(data);
    });

    // Cleanup handlers when component unmounts
    return () => {
      setMessageHandler(null);
      setConversationHandler(null);
      setTypingStartHandler(null);
      setTypingStopHandler(null);
    };
  }, [selectedUser, currentUser, typingIndicator, setMessageHandler, setConversationHandler, setTypingStartHandler, setTypingStopHandler]);

  // Session data is now provided by SSEProvider - no need to fetch it here

  // Fetch all users for recipient selection
  useEffect(() => {
    fetch('/api/users/list')
      .then(res => res.json())
      .then(data => {
        if (data.success) setUsers(data.users);
      });
  }, []);

  // Fetch all conversations (users with whom there is at least one message)
  useEffect(() => {
    if (!currentUser) {
      setConversations([]);
      return;
    }

    // Use the new private conversations API to get actual conversations
    fetch('/api/private-conversations')
      .then(res => {
        if (!res.ok) {
          throw new Error(`API request failed with status ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.success && data.conversations) {
          // Map the conversation data to the format expected by the UI
          const conversationUsers: User[] = data.conversations.map((conv: Conversation) => ({
            user_id: conv.other_user.user_id,
            username: conv.other_user.username
          }));
          setConversations(conversationUsers);
        } else {
          console.error("API error fetching conversations:", data.message || 'Unknown error');
          setConversations([]);
        }
      })
      .catch(error => {
        console.error("Failed to fetch conversations:", error);
        setConversations([]);
      });
  }, [currentUser, refresh]);

  // Debug: log fetched users for mentions
  useEffect(() => {
    console.log('Mention users loaded:', users);
  }, [users]);

  // Function to detect and show mention suggestions
  const handleMention = (text: string, cursorPos: number) => {
    console.log('handleMention called with:', text, 'cursor:', cursorPos);
    const uptoCursor = text.slice(0, cursorPos);
    const atIndex = uptoCursor.lastIndexOf('@');
    console.log('uptoCursor:', uptoCursor, 'atIndex:', atIndex);
    if (atIndex >= 0) {
      const query = uptoCursor.slice(atIndex + 1);
      console.log('handleMention query:', query);
      if (/^\w*$/.test(query)) {
        setMentionQuery(query);
        // Show all users when just '@', otherwise filter by query
        const matches = query === ''
          ? users
          : users.filter(u =>
              u.username.toLowerCase().startsWith(query.toLowerCase()) ||
              (u.display_name && u.display_name.toLowerCase().startsWith(query.toLowerCase()))
            );
      console.log('mention matches:', matches);
        setMentionSuggestions(matches);
        setShowMentionSuggestions(matches.length > 0);
        return;
      }
    }
    setShowMentionSuggestions(false);
  };
  const fetchMessages = () => {
    if (!selectedUser || !currentUser) return;
    fetch(`/api/messages?user_id=${selectedUser}`)
      .then(res => res.json())
      .then((data: any) => {
        if (data.success) {
          // Only show messages between currentUser and selectedUser
          const filtered = data.pms.filter((msg: Message) =>
            (msg.sender_id === currentUser.user_id && msg.receiver_id === selectedUser) ||
            (msg.sender_id === selectedUser && msg.receiver_id === currentUser.user_id)
          );
          setMessages(filtered.sort((a: Message, b: Message) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
        }
      });
  };

  useEffect(() => {
    fetchMessages();
    // Real-time updates now handled by WebSocket, no need for polling
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line
  }, [selectedUser, refresh]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newMessage) return;
    
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: selectedUser, content: newMessage }),
    });
    const data = await res.json();
    if (data.success) {
      setNewMessage('');
      // WebSocket will handle real-time updates for both sender and receiver
      // No need for manual refresh as WebSocket notifications will trigger updates
    }
  };

  // New user message button handler
  const handleNewUserMessage = () => {
    setShowNewUserModal(true);
  };

  const handleSelectNewUser = async (userId: string) => {
    setSelectedUser(userId);
    setShowNewUserModal(false);
    
    try {
      // Create the conversation in the private conversations system
      const res = await protectedFetch('/api/private-conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          other_user_id: userId
        })
      });
      
      const data = await res.json();
      if (data.success) {
        // Refresh conversations list to include the new conversation
        setRefresh(r => r + 1);
      } else {
        console.error('Failed to create conversation:', data.message);
        // Still allow user to see the selected user, conversation will be created when first message is sent
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
      // Still allow user to see the selected user, conversation will be created when first message is sent
    }
  };

  // Mark messages as read when viewing a conversation
  useEffect(() => {
    if (!selectedUser || !currentUser) return;
    // Find if there are any unread messages from selectedUser to currentUser
    const hasUnread = messages.some(
      msg => msg.sender_id === selectedUser && msg.receiver_id === currentUser.user_id && !msg.read
    );
    if (hasUnread) {
      protectedFetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: selectedUser }),
      }).then(() => setRefresh(r => r + 1));
    }
    // Only run when selectedUser, currentUser, or messages change
  }, [selectedUser, currentUser, messages, protectedFetch]);

  // Clear messages immediately when switching users
  useEffect(() => {
    setMessages([]);
  }, [selectedUser]);

  // Smooth scroll to bottom function
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Auto-scroll when new messages arrive
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  // Delete individual message function
  const deleteMessage = async (messageId: string): Promise<boolean> => {
    try {
      // For private messages, use the general messages endpoint
      const response = await protectedFetch('/api/messages', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message_id: messageId })
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      const data = await response.json();
      if (data.success) {
        // Refresh messages after deletion
        fetchMessages();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  };

  // Add settings button and modal in main chat area header
  return (
    <div className="flex flex-col md:flex-row h-[80vh] max-w-4xl w-full mx-auto bg-black/80 border border-white rounded-lg shadow-lg mt-8 min-h-[500px] min-w-[350px]">
      {/* Sidebar: user list */}
      <div className="w-full md:w-1/3 border-r border-white p-4 overflow-y-auto min-w-[220px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Chats</h2>
          <button onClick={handleNewUserMessage} className="p-2 bg-white text-black rounded hover:bg-gray-200 text-sm">New Message</button>
        </div>
        
        {/* Connection status indicator */}
        <div className="mb-4 text-sm">
          <div className={`inline-flex items-center px-2 py-1 rounded text-xs ${
            isConnected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-300' : 'bg-red-300'}`}></div>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          {connectionError && (
            <div className="text-red-400 text-xs mt-1">
              Error: {connectionError}
            </div>
          )}
          <div className="text-gray-400 text-xs mt-1">
            Token: {sessionToken ? sessionToken.substring(0, 8) + '...' : 'None'}
          </div>
        </div>
        <ul>
          {conversations.map(u => (
            <li key={u.user_id}>
              <button
                className={`w-full text-left p-2 rounded mb-2 transition-colors flex items-center space-x-3 ${selectedUser === u.user_id ? 'bg-white text-black' : 'bg-black/60 text-white hover:bg-white/10'}`}
                onClick={() => setSelectedUser(u.user_id)}
              >
                <ProfileAvatar userId={u.user_id} size={32} />
                <span>{getAnonymousDisplayName(u.display_name, u.username, u.user_id)}</span>
              </button>
            </li>
          ))}
        </ul>
        {/* New user modal */}
        {showNewUserModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50">
            <div className="bg-black border border-white p-6 rounded max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4 text-white">Start New Conversation</h2>
              <ul>
                {users.filter(u => u.user_id !== currentUser?.user_id).map(u => (
                  <li key={u.user_id}>
                    <button
                      className="w-full text-left p-2 rounded mb-2 bg-white text-black hover:bg-gray-200 flex items-center space-x-3"
                      onClick={() => handleSelectNewUser(u.user_id)}
                    >                <ProfileAvatar userId={u.user_id} size={32} />
                <span>{getAnonymousDisplayName(u.display_name, u.username, u.user_id)}</span>
              </button>
                  </li>
                ))}
              </ul>
              <button className="mt-4 p-2 bg-red-600 text-white rounded hover:bg-red-700 w-full" onClick={() => setShowNewUserModal(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-full min-w-[0]">
        {/* Chat header with settings button */}
        <div className="flex items-center justify-between border-b border-white px-4 py-2 bg-black/70">
          <div className="font-bold text-lg text-white flex items-center space-x-3">
            {selectedUser ? (
              <>
                <ProfileAvatar userId={selectedUser} size={32} />
                <span>{(() => {
                  const user = users.find(u => u.user_id === selectedUser);
                  return getAnonymousDisplayName(user?.display_name, user?.username, selectedUser);
                })()}</span>
              </>
            ) : (
              'Select a chat'
            )}
          </div>
          {selectedUser && (
            <button
              className="p-2 rounded bg-gray-800 text-white hover:bg-gray-700 text-sm ml-2"
              onClick={() => setShowSettings(true)}
              title="Chat Settings"
            >
              ⚙️ Settings
            </button>
          )}
        </div>
        {/* Settings modal */}
        {showSettings && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50">
            <div className="bg-black border border-white p-6 rounded max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4 text-white">Chat Settings</h2>
              <button
                className="mb-4 p-2 bg-red-600 text-white rounded hover:bg-red-700 w-full"
                onClick={async () => {
                  if (window.confirm('Are you sure you want to delete all messages in this chat? This cannot be undone.')) {
                    console.log('Sending DELETE request with selectedUser:', selectedUser);
                    console.log('Current user:', currentUser);
                    const res = await protectedFetch('/api/private-conversations', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        other_user_id: selectedUser,
                        // Add default profile types - backend will handle all collections if no specific profile context
                        sender_profile_type: 'basic',
                        receiver_profile_type: 'basic'
                      }),
                    });
                    const data = await res.json();
                    console.log('DELETE response:', data);
                    if (data.success) {
                      setMessages([]);
                      setRefresh(r => r + 1);
                      setShowSettings(false);
                    } else {
                      alert('Failed to delete messages: ' + (data.message || 'Unknown error'));
                    }
                  }
                }}
              >
                Delete All Messages in This Chat
              </button>
              <div className="mb-2 text-white font-semibold">Set auto-delete period (days):</div>
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  // TODO: Implement API for auto-delete period
                  alert('Auto-delete period set to ' + autoDeleteDays + ' days (feature not yet implemented)');
                  setShowSettings(false);
                }}
                className="flex gap-2 mb-4"
              >
                <input
                  type="number"
                  min="1"
                  className="flex-1 p-2 bg-black text-white border border-white rounded focus:outline-none"
                  value={autoDeleteDays}
                  onChange={e => setAutoDeleteDays(e.target.value)}
                  placeholder="Days"
                />
                <button type="submit" className="p-2 bg-white text-black rounded hover:bg-gray-200">Set</button>
              </form>
              <button className="p-2 bg-gray-700 text-white rounded w-full" onClick={() => setShowSettings(false)}>Close</button>
            </div>
          </div>
        )}
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 min-h-[300px] max-h-[calc(80vh-120px)] scroll-smooth"
          style={{ scrollBehavior: 'smooth' }}
        >
          {selectedUser ? (
            <div className="flex flex-col gap-2">
              {messages.length === 0 ? (
                <div className="text-gray-400 text-center">No messages yet. Say hi!</div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg._id}
                    className={`flex ${msg.sender_id === currentUser?.user_id ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.sender_id !== currentUser?.user_id && (
                      <div className="mr-2 mt-1">
                        <ProfileAvatar userId={msg.sender_id} size={28} />
                      </div>
                    )}
                    <div
                      className={`max-w-sm px-4 py-2 rounded-lg shadow text-sm mb-1 relative break-words ${msg.sender_id === currentUser?.user_id ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}
                    >
                      <div className="break-words">
                        {msg.content.split(/(@\w*)/g).map((part, idx) =>
                          part.startsWith('@') ? (
                            <span
                              key={idx}
                              className={`inline-block font-mono px-1 py-0.5 rounded ${msg.sender_id === currentUser?.user_id ? 'bg-blue-700 text-white' : 'bg-yellow-300 text-black'}`}
                            >
                              {part}
                            </span>
                          ) : (
                            <span key={idx}>{part}</span>
                          )
                        )}
                      </div>
                      <div className="text-xs text-right text-gray-300 mt-1 flex items-center gap-2">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.sender_id === currentUser?.user_id && (
                          <span className={msg.read ? 'text-green-400' : 'text-gray-400'}>
                            {msg.read ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                      {msg.sender_id === currentUser?.user_id && (
                        <button
                          onClick={() => deleteMessage(msg._id!)}
                          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"
                          title="Delete message"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
              
              {/* Typing Indicator */}
              <TypingIndicator typingUsers={typingIndicator.typingUsers} className="px-4 py-2" />
            </div>
          ) : (
            <div className="text-gray-400 text-center mt-8">Select a user to start chatting.</div>
          )}
        </div>
        {/* Message input */}
        {selectedUser && (
          <form onSubmit={handleSend} className="flex gap-2 p-4 border-t border-white bg-black/80">
        <div className="relative flex-1">
          <input
            type="text"
            value={newMessage}
            onChange={e => {
              console.log('onChange triggered - e.target.value:', e.target.value);
              const val = e.target.value;
              console.log('Input changed:', val, 'cursor:', e.target.selectionStart);
              setNewMessage(val);
              typingIndicator.emitTyping(); // Emit typing indicator when user types
              handleMention(val, e.target.selectionStart || val.length);
            }}
            onInput={e => {
              console.log('onInput triggered - value:', (e.target as HTMLInputElement).value);
            }}
            onKeyDown={e => {
              console.log('onKeyDown triggered - key:', e.key, 'value:', (e.target as HTMLInputElement).value);
            }}
            className="w-full p-2 bg-black text-white border border-white rounded focus:outline-none"
            placeholder="Type your message..."
            required
          />
          {showMentionSuggestions && (
            <ul className="absolute left-0 top-full mt-1 w-full max-h-40 overflow-auto bg-black border border-white rounded shadow-lg z-50">
              {mentionSuggestions.map(user => (
                <li
                  key={user.user_id}
                  className="px-2 py-1 hover:bg-white/20 cursor-pointer"
                  onMouseDown={e => {
                    // Insert mention and hide suggestions
                    e.preventDefault();
                    const insertText = `@${user.username} `;
                    const before = newMessage.slice(0, newMessage.lastIndexOf(`@${mentionQuery}`));
                    const after = newMessage.slice((newMessage.lastIndexOf(`@${mentionQuery}`) || 0) + mentionQuery.length + 1);
                    const updated = before + insertText + after;
                    setNewMessage(updated);
                    setShowMentionSuggestions(false);
                  }}
                >
                  {user.display_name || user.username}
                </li>
              ))}
            </ul>
          )}
        </div>
            <button type="submit" className="p-2 bg-white text-black rounded hover:bg-gray-200">Send</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Messages;