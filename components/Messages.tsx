import React, { useEffect, useState, useRef } from 'react';

interface Message {
  _id?: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachments: string[];
}

interface User {
  user_id: string;
  username: string;
}

const Messages = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [currentUser, setCurrentUser] = useState<{ user_id: string; username: string } | null>(null);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoDeleteDays, setAutoDeleteDays] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch current user info
  useEffect(() => {
    fetch('/api/session')
      .then(res => res.json())
      .then(data => {
        if (data.valid && data.user) setCurrentUser({ user_id: data.user.user_id, username: data.user.username });
      });
  }, []);

  // Fetch all users for recipient selection
  useEffect(() => {
    fetch('/api/users/list')
      .then(res => res.json())
      .then(data => {
        if (data.success) setUsers(data.users);
      });
  }, []);

  // Fetch messages with selected user
  const fetchMessages = () => {
    if (!selectedUser || !currentUser) return;
    setLoading(true);
    fetch(`/api/messages?user_id=${selectedUser}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Only show messages between currentUser and selectedUser
          const filtered = data.pms.filter((msg: Message) =>
            (msg.sender_id === currentUser.user_id && msg.receiver_id === selectedUser) ||
            (msg.sender_id === selectedUser && msg.receiver_id === currentUser.user_id)
          );
          setMessages(filtered.sort((a: Message, b: Message) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
        } else {
          setError(data.message || 'Failed to load messages');
        }
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMessages();
    // Live update: poll every 2 seconds
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (selectedUser) {
      intervalRef.current = setInterval(fetchMessages, 2000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line
  }, [selectedUser, refresh]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      setRefresh(r => r + 1);
    } else {
      setError(data.message || 'Failed to send message');
    }
  };

  // New user message button handler
  const handleNewUserMessage = () => {
    setShowNewUserModal(true);
  };

  const handleSelectNewUser = (userId: string) => {
    setSelectedUser(userId);
    setShowNewUserModal(false);
  };

  // Mark messages as read when viewing a conversation
  useEffect(() => {
    if (!selectedUser || !currentUser) return;
    // Find if there are any unread messages from selectedUser to currentUser
    const hasUnread = messages.some(
      msg => msg.sender_id === selectedUser && msg.receiver_id === currentUser.user_id && !msg.read
    );
    if (hasUnread) {
      fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: selectedUser }),
      }).then(() => setRefresh(r => r + 1));
    }
    // Only run when selectedUser, currentUser, or messages change
  }, [selectedUser, currentUser, messages]);

  // Clear messages immediately when switching users
  useEffect(() => {
    setMessages([]);
  }, [selectedUser]);

  // Add settings button and modal in main chat area header
  return (
    <div className="flex flex-col md:flex-row h-[80vh] max-w-4xl w-full mx-auto bg-black/80 border border-white rounded-lg shadow-lg mt-8 min-h-[500px] min-w-[350px]">
      {/* Sidebar: user list */}
      <div className="w-full md:w-1/3 border-r border-white p-4 overflow-y-auto min-w-[220px]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Chats</h2>
          <button onClick={handleNewUserMessage} className="p-2 bg-white text-black rounded hover:bg-gray-200 text-sm">New Message</button>
        </div>
        <ul>
          {users.filter(u => u.user_id !== currentUser?.user_id).map(u => (
            <li key={u.user_id}>
              <button
                className={`w-full text-left p-2 rounded mb-2 transition-colors ${selectedUser === u.user_id ? 'bg-white text-black' : 'bg-black/60 text-white hover:bg-white/10'}`}
                onClick={() => setSelectedUser(u.user_id)}
              >
                {u.username}
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
                {users.filter(u => u.user_id !== currentUser?.user_id && u.user_id !== selectedUser).map(u => (
                  <li key={u.user_id}>
                    <button
                      className="w-full text-left p-2 rounded mb-2 bg-white text-black hover:bg-gray-200"
                      onClick={() => handleSelectNewUser(u.user_id)}
                    >
                      {u.username}
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
          <div className="font-bold text-lg text-white">
            {selectedUser ? users.find(u => u.user_id === selectedUser)?.username : 'Select a chat'}
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
                    await fetch('/api/messages', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ other_user_id: selectedUser }),
                    });
                    setMessages([]);
                    setRefresh(r => r + 1);
                    setShowSettings(false);
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
        <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
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
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg shadow text-sm mb-1 relative ${msg.sender_id === currentUser?.user_id ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}
                    >
                      <div>{msg.content}</div>
                      <div className="text-xs text-right text-gray-300 mt-1 flex items-center gap-2">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.sender_id === currentUser?.user_id && (
                          <span className={msg.read ? 'text-green-400' : 'text-gray-400'}>
                            {msg.read ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="text-gray-400 text-center mt-8">Select a user to start chatting.</div>
          )}
        </div>
        {/* Message input */}
        {selectedUser && (
          <form onSubmit={handleSend} className="flex gap-2 p-4 border-t border-white bg-black/80">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              className="flex-1 p-2 bg-black text-white border border-white rounded focus:outline-none"
              placeholder="Type your message..."
              required
            />
            <button type="submit" className="p-2 bg-white text-black rounded hover:bg-gray-200">Send</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Messages;