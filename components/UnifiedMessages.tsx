import React, { useEffect, useState, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers,
  faUser,
  faSearch,
  faPaperPlane,
  faUserPlus,
  faTimes,
  faLock,
  faGlobe,
  faBell,
  faHashtag,
  faAt,
  faCheck,
  faCheckDouble
} from '@fortawesome/free-solid-svg-icons';

// Interfaces
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
  sender_id: string;
  content: string;
  timestamp: string;
  attachments: string[];
  sender_username: string;
}

interface User {
  user_id: string;
  username: string;
}

interface Group {
  _id?: string;
  group_id: string;
  name: string;
  description: string;
  creator_id: string;
  creation_date: string;
  is_private: boolean;
  members_count: number;
  topic: string;
  status: string;
  last_activity: string;
  user_role?: string;
}

interface GroupMember {
  user_id: string;
  username: string;
  role: string;
  join_date: string;
}

interface GroupInvitation {
  invitation_id: string;
  group_id: string;
  group_name: string;
  inviter_id: string;
  inviter_username: string;
  invited_user_id: string;
  created_at: string;
  status: string;
}

interface Conversation {
  id: string;
  name: string;
  type: 'direct' | 'group';
  is_private?: boolean;
  last_message?: string;
  last_activity?: string;
  unread_count?: number;
  members_count?: number;
}

type ContextMenuExtra = Conversation | PrivateMessage | GroupMessage | undefined;

const UnifiedMessages = () => {
  // State management
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string>('');
  const [selectedConversationType, setSelectedConversationType] = useState<'direct' | 'group'>('direct');
  const [messages, setMessages] = useState<(PrivateMessage | GroupMessage)[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<{ user_id: string; username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  
  // Modal states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showNewDMModal, setShowNewDMModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInvitationsModal, setShowInvitationsModal] = useState(false);
  
  // Form states
  const [createGroupForm, setCreateGroupForm] = useState({
    name: '',
    description: '',
    topic: '',
    is_private: false
  });
  const [selectedUserForDM, setSelectedUserForDM] = useState('');
  const [selectedUserToInvite, setSelectedUserToInvite] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [inviteLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'conversation' | 'message';
    id: string;
    extra?: ContextMenuExtra;
  } | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch current user
  useEffect(() => {
    fetch('/api/session')
      .then(res => res.json())
      .then(data => {
        if (data.valid && data.user) {
          setCurrentUser({ user_id: data.user.user_id, username: data.user.username });
        }
      });
  }, []);

  // Fetch all users for DMs and invitations
  useEffect(() => {
    if (currentUser) {
      fetch('/api/users/list')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const filteredUsers = data.users.filter((u: User) => u.user_id !== currentUser.user_id);
            setUsers(filteredUsers);
          }
        });
    }
  }, [currentUser]);

  // Fetch conversations (combination of DMs and groups)
  const fetchConversations = useCallback(async () => {
    if (!currentUser) return;

    try {
      // Fetch DMs
      const dmsRes = await fetch('/api/messages');
      const dmsData = await dmsRes.json();
      
      // Fetch groups
      const groupsRes = await fetch('/api/groups/list');
      const groupsData = await groupsRes.json();

      const dmConversations: Conversation[] = [];
      const groupConversations: Conversation[] = [];

      if (dmsData.success && dmsData.pms) {
        const uniqueUsers = new Map<string, PrivateMessage>();
        
        dmsData.pms.forEach((msg: PrivateMessage) => {
          const otherUserId = msg.sender_id === currentUser.user_id ? msg.receiver_id : msg.sender_id;
          if (!uniqueUsers.has(otherUserId) || new Date(msg.timestamp) > new Date(uniqueUsers.get(otherUserId)!.timestamp)) {
            uniqueUsers.set(otherUserId, msg);
          }
        });

        for (const [userId, lastMsg] of uniqueUsers) {
          const user = users.find(u => u.user_id === userId);
          if (user) {
            dmConversations.push({
              id: userId,
              name: user.username,
              type: 'direct',
              last_message: lastMsg.content,
              last_activity: lastMsg.timestamp,
              unread_count: 0 // TODO: Implement unread count
            });
          }
        }
      }

      if (groupsData.success && groupsData.groups) {
        groupsData.groups.forEach((group: Group) => {
          groupConversations.push({
            id: group.group_id,
            name: group.name,
            type: 'group',
            is_private: group.is_private,
            last_activity: group.last_activity,
            members_count: group.members_count,
            unread_count: 0 // TODO: Implement unread count
          });
        });
      }

      // Sort by last activity
      const allConversations = [...dmConversations, ...groupConversations].sort((a, b) => 
        new Date(b.last_activity || 0).getTime() - new Date(a.last_activity || 0).getTime()
      );

      setConversations(allConversations);
      setLoading(false);
    } catch {
      setError('Failed to load conversations');
      setLoading(false);
    }
  }, [currentUser, users]);

  // Fetch invitations
  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch('/api/invitations');
      const data = await res.json();
      if (data.success) {
        setInvitations(data.invitations);
      }
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    }
  }, []);

  useEffect(() => {
    if (currentUser && users.length > 0) {
      fetchConversations();
      fetchInvitations();
    }
  }, [currentUser, users, fetchConversations, fetchInvitations]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string, type: 'direct' | 'group') => {
    try {
      let url: string;
      if (type === 'direct') {
        url = `/api/messages`;
      } else {
        url = `/api/groups/${conversationId}/messages`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        if (type === 'direct' && data.pms) {
          const filteredMessages = data.pms.filter((msg: PrivateMessage) => 
            (msg.sender_id === conversationId && msg.receiver_id === currentUser?.user_id) ||
            (msg.sender_id === currentUser?.user_id && msg.receiver_id === conversationId)
          );
          // Sort ascending by timestamp
          filteredMessages.sort((a: PrivateMessage, b: PrivateMessage) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setMessages(filteredMessages);
        } else if (type === 'group' && data.messages) {
          // Sort ascending by timestamp
          (data.messages as GroupMessage[]).sort((a: GroupMessage, b: GroupMessage) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setMessages(data.messages);
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, [currentUser]);

  // Fetch group members
  const fetchGroupMembers = async (groupId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/members`);
      const data = await res.json();
      if (data.success) {
        setGroupMembers(data.members);
      }
    } catch (err) {
      console.error('Failed to fetch group members:', err);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;

    try {
      let url: string;
      let body: Record<string, unknown>;

      if (selectedConversationType === 'direct') {
        url = '/api/messages';
        body = {
          receiver_id: selectedConversation,
          content: newMessage,
          attachments: []
        };
      } else {
        url = `/api/groups/${selectedConversation}/messages`;
        body = {
          content: newMessage,
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
        setNewMessage('');
        fetchMessages(selectedConversation, selectedConversationType);
        fetchConversations(); // Refresh conversation list
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Handle conversation selection
  const selectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation.id);
    setSelectedConversationType(conversation.type);
    fetchMessages(conversation.id, conversation.type);
    
    if (conversation.type === 'group') {
      fetchGroupMembers(conversation.id);
    }
  };

  // Create new group
  const createGroup = async () => {
    try {
      const res = await fetch('/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createGroupForm)
      });

      const data = await res.json();
      if (data.success) {
        setShowCreateGroupModal(false);
        setCreateGroupForm({ name: '', description: '', topic: '', is_private: false });
        fetchConversations();
      }
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  // Start new DM
  const startNewDM = () => {
    if (!selectedUserForDM) return;
    
    const conversation: Conversation = {
      id: selectedUserForDM,
      name: users.find(u => u.user_id === selectedUserForDM)?.username || 'Unknown',
      type: 'direct'
    };
    
    selectConversation(conversation);
    setShowNewDMModal(false);
    setSelectedUserForDM('');
  };

  // Auto-refresh
  useEffect(() => {
    if (selectedConversation) {
      intervalRef.current = setInterval(() => {
        fetchMessages(selectedConversation, selectedConversationType);
      }, 3000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [selectedConversation, selectedConversationType, fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mark messages as read when viewing a private conversation
  useEffect(() => {
    if (!selectedConversation || !currentUser || selectedConversationType !== 'direct') return;
    
    // Find if there are any unread messages from selectedConversation (sender) to currentUser (receiver)
    const hasUnread = messages
      .filter((msg): msg is PrivateMessage => (msg as PrivateMessage).receiver_id !== undefined && (msg as PrivateMessage).read !== undefined)
      .some(
        msg => msg.sender_id === selectedConversation && msg.receiver_id === currentUser.user_id && !msg.read
      );
    
    if (hasUnread) {
      fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender_id: selectedConversation }),
      }).then(() => {
        // Refresh messages to show updated read status
        fetchMessages(selectedConversation, selectedConversationType);
      });
    }
  }, [selectedConversation, selectedConversationType, currentUser, messages, fetchMessages]);

  // Fetch available users for invitation
  const fetchAvailableUsers = async () => {
    if (!selectedConversation) return;

    try {
      const res = await fetch(`/api/users/available?group_id=${selectedConversation}`);
      const data = await res.json();
      if (data.success) {
        setAvailableUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to fetch available users:', err);
    }
  };

  // Respond to invitation
  const respondToInvitation = async (invitationId: string, response: 'accept' | 'decline') => {
    try {
      const res = await fetch(`/api/invitations/${invitationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response })
      });

      const data = await res.json();
      if (data.success) {
        fetchInvitations();
        fetchConversations();
        if (response === 'accept') {
          alert('Invitation accepted! You have joined the group.');
        }
      }
    } catch (err) {
      console.error('Failed to respond to invitation:', err);
    }
  };

  const selectedConversationData = conversations.find(c => c.id === selectedConversation);

  // Handle right-click on conversation
  const handleConversationContextMenu = (e: React.MouseEvent, conversation: Conversation) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'conversation',
      id: conversation.id,
      extra: conversation
    });
  };

  // Handle right-click on message
  const handleMessageContextMenu = (e: React.MouseEvent, message: PrivateMessage | GroupMessage) => {
    e.preventDefault();
    // Only allow delete if user is sender
    if (message.sender_id !== currentUser?.user_id) return;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'message',
      id: (message as PrivateMessage)._id || (message as GroupMessage).message_id,
      extra: message
    });
  };

  // Delete conversation (DM or group)
  const deleteConversation = async (conv: Conversation) => {
    if (conv.type === 'direct') {
      await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ other_user_id: conv.id })
      });
    } else if (conv.type === 'group') {
      // If user is group creator, delete group; otherwise, leave group
      if (groupMembers.find(m => m.user_id === currentUser?.user_id && m.role === 'owner')) {
        await fetch(`/api/groups/${conv.id}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/groups/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: conv.id })
        });
      }
    }
    setContextMenu(null);
    setSelectedConversation('');
    fetchConversations();
  };

  // Delete message
  const deleteMessage = async (msg: PrivateMessage | GroupMessage) => {
    if (selectedConversationType === 'direct') {
      await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: (msg as PrivateMessage)._id })
      });
    } else {
      await fetch(`/api/groups/${selectedConversation}/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: (msg as GroupMessage).message_id })
      });
    }
    setContextMenu(null);
    fetchMessages(selectedConversation, selectedConversationType);
  };

  // Hide context menu on click elsewhere
  useEffect(() => {
    const hideMenu = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', hideMenu);
      return () => window.removeEventListener('click', hideMenu);
    }
  }, [contextMenu]);

  // Invite user to group
  const inviteUserToGroup = async () => {
    if (!selectedUserToInvite || !selectedConversation) return;
    try {
      const res = await fetch(`/api/groups/${selectedConversation}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUserToInvite })
      });
      const data = await res.json();
      if (data.success) {
        setShowInviteModal(false);
        setSelectedUserToInvite('');
      } else {
        setError(data.error || 'Failed to send invitation');
      }
    } catch {
      setError('Failed to send invitation');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-white">
        <div className="text-xl">Loading conversations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="text-xl text-red-400 mb-4">Error loading conversations</div>
          <div className="text-gray-400">{error}</div>
          <button 
            onClick={() => {
              setError('');
              setLoading(true);
              fetchConversations();
            }}
            className="mt-4 bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-black text-white">
      {/* Sidebar - Conversations List */}
      <div className="w-80 bg-black flex flex-col border-r border-white">
        {/* Header */}
        <div className="p-4 border-b border-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Messages</h1>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowNewDMModal(true)
                }
                className="p-2 bg-white text-black rounded-full hover:bg-gray-200 transition-colors"
                title="New Direct Message"
              >
                <FontAwesomeIcon icon={faUser} />
              </button>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="p-2 bg-white text-black rounded-full hover:bg-gray-200 transition-colors"
                title="Create Group"
              >
                <FontAwesomeIcon icon={faUsers} />
              </button>
              <button
                onClick={() => {
                  setShowInvitationsModal(true);
                  fetchInvitations();
                }}
                className="relative p-2 bg-white text-black rounded-full hover:bg-gray-200 transition-colors"
                title="Invitations"
              >
                <FontAwesomeIcon icon={faBell} />
                {invitations.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-black text-white text-xs rounded-full h-5 w-5 flex items-center justify-center border border-white">
                    {invitations.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black text-white border border-white rounded px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <FontAwesomeIcon 
              icon={faSearch} 
              className="absolute left-3 top-3 text-white opacity-60"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {(() => {
            const filteredConversations = conversations.filter(conversation => 
              conversation.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            
            if (filteredConversations.length === 0 && conversations.length > 0) {
              return (
                <div className="p-4 text-center text-gray-400">
                  No conversations match &quot;{searchQuery}&quot;
                </div>
              );
            }
            
            if (conversations.length === 0) {
              return (
                <div className="p-4 text-center text-gray-400">
                  <div className="mb-4">No conversations yet</div>
                  <div className="text-sm">Start a new conversation or create a group to get started!</div>
                </div>
              );
            }
            
            return filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => selectConversation(conversation)}
                onContextMenu={e => handleConversationContextMenu(e, conversation)}
                className={`p-3 border-b border-white cursor-pointer hover:bg-gray-700 transition-colors ${
                  selectedConversation === conversation.id ? 'bg-blue-600' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon 
                      icon={conversation.type === 'group' ? faUsers : faUser} 
                      className="text-white"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium truncate">{conversation.name}</span>
                      {conversation.type === 'group' && conversation.is_private && (
                        <FontAwesomeIcon icon={faLock} className="text-gray-400 text-xs" />
                      )}
                      {conversation.type === 'group' && !conversation.is_private && (
                        <FontAwesomeIcon icon={faGlobe} className="text-gray-400 text-xs" />
                      )}
                    </div>
                    {conversation.last_message && (
                      <p className="text-sm text-gray-400 truncate">{conversation.last_message}</p>
                    )}
                    {conversation.type === 'group' && conversation.members_count && (
                      <p className="text-xs text-gray-500">{conversation.members_count} members</p>
                    )}
                  </div>
                  {conversation.unread_count && conversation.unread_count > 0 && (
                    <span className="bg-red-500 text-xs rounded-full px-2 py-1">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-white bg-black">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-black border border-white rounded-full flex items-center justify-center">
                    <FontAwesomeIcon 
                      icon={selectedConversationType === 'group' ? faHashtag : faAt} 
                      className="text-white text-sm"
                    />
                  </div>
                  <div>
                    <h2 className="font-bold">{selectedConversationData?.name}</h2>
                    {selectedConversationType === 'group' && selectedConversationData?.members_count && (
                      <p className="text-sm text-white opacity-60">{selectedConversationData.members_count} members</p>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {selectedConversationType === 'group' && (
                    <>
                      <button
                        onClick={() => {
                          setShowMembersModal(true);
                          fetchGroupMembers(selectedConversation);
                        }}
                        className="p-2 bg-white text-black rounded hover:bg-gray-200 transition-colors"
                        title="View Members"
                      >
                        <FontAwesomeIcon icon={faUsers} />
                      </button>
                      {selectedConversationData?.is_private && (
                        <button
                          onClick={() => {
                            setShowInviteModal(true);
                            fetchAvailableUsers();
                          }}
                          className="p-2 bg-white text-black rounded hover:bg-gray-200 transition-colors"
                          title="Invite User"
                        >
                          <FontAwesomeIcon icon={faUserPlus} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black">
              {messages.map((message, index) => {
                const isOwn = message.sender_id === currentUser?.user_id;
                const senderName = selectedConversationType === 'group' 
                  ? (message as GroupMessage).sender_username 
                  : isOwn 
                    ? 'You' 
                    : selectedConversationData?.name;

                return (
                  <div key={index} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    onContextMenu={e => handleMessageContextMenu(e, message)}
                  >
                    <div className={`max-w-xs lg:max-w-md ${isOwn ? 'bg-white text-black' : 'bg-black text-white border border-white'} rounded-lg p-3`}>
                      {selectedConversationType === 'group' && !isOwn && (
                        <p className="text-xs text-white opacity-60 mb-1">{senderName}</p>
                      )}
                      <p>{message.content}</p>
                      <div className="flex items-center space-x-1 mt-1">
                        <span className="text-xs text-white opacity-60">{new Date(message.timestamp).toLocaleTimeString()}</span>
                        {isOwn && (
                          <FontAwesomeIcon
                            icon={
                              selectedConversationType === 'direct'
                                ? ((message as PrivateMessage).read ? faCheckDouble : faCheck)
                                : faCheckDouble
                            }
                            className="text-xs"
                            style={{
                              color: selectedConversationType === 'direct'
                                ? ((message as PrivateMessage).read ? '#4ade80' : '#9ca3af')
                                : '#4ade80'
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-white bg-black">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={`Message ${selectedConversationType === 'group' ? '#' : '@'}${selectedConversationData?.name}`}
                  className="flex-1 bg-black text-white border border-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white"
                />
                <button
                  onClick={sendMessage}
                  className="bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors border border-white"
                >
                  <FontAwesomeIcon icon={faPaperPlane} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-black">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Welcome to Messages</h2>
              <p className="text-white opacity-60">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-black border border-white p-6 rounded-lg w-96 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Create Group</h3>
              <button onClick={() => setShowCreateGroupModal(false)} className="text-white hover:text-gray-300">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Group Name"
                value={createGroupForm.name}
                onChange={(e) => setCreateGroupForm({...createGroupForm, name: e.target.value})}
                className="w-full bg-black text-white border border-white rounded px-3 py-2 focus:outline-none"
              />
              <textarea
                placeholder="Description"
                value={createGroupForm.description}
                onChange={(e) => setCreateGroupForm({...createGroupForm, description: e.target.value})}
                className="w-full bg-black text-white border border-white rounded px-3 py-2 h-20 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Topic"
                value={createGroupForm.topic}
                onChange={(e) => setCreateGroupForm({...createGroupForm, topic: e.target.value})}
                className="w-full bg-black text-white border border-white rounded px-3 py-2 focus:outline-none"
              />
              <label className="flex items-center space-x-2 text-white">
                <input
                  type="checkbox"
                  checked={createGroupForm.is_private}
                  onChange={(e) => setCreateGroupForm({...createGroupForm, is_private: e.target.checked})}
                  className="mr-2"
                />
                <span>Private Group</span>
              </label>
              <button
                onClick={createGroup}
                className="w-full bg-white text-black py-2 rounded hover:bg-gray-200 border border-white font-semibold"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New DM Modal */}
      {showNewDMModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-black border border-white p-6 rounded-lg w-96 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">New Direct Message</h3>
              <button onClick={() => setShowNewDMModal(false)} className="text-white hover:text-gray-300">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="space-y-4">
              <select
                value={selectedUserForDM}
                onChange={(e) => setSelectedUserForDM(e.target.value)}
                className="w-full bg-black text-white border border-white rounded px-3 py-2 focus:outline-none"
              >
                <option value="">Select a user</option>
                {users.map(user => (
                  <option key={user.user_id} value={user.user_id}>{user.username}</option>
                ))}
              </select>
              <button
                onClick={startNewDM}
                disabled={!selectedUserForDM}
                className="w-full bg-white text-black py-2 rounded hover:bg-gray-200 border border-white font-semibold disabled:opacity-50"
              >
                Start Conversation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-black border border-white p-6 rounded-lg w-96 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Group Members</h3>
              <button onClick={() => setShowMembersModal(false)} className="text-white hover:text-gray-300">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {groupMembers.map(member => (
                <div key={member.user_id} className="flex items-center justify-between p-2 bg-black border border-white rounded">
                  <span className="text-white">{member.username}</span>
                  <span className="text-sm text-gray-400">{member.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-black border border-white p-6 rounded-lg w-96 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Invite User</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-white hover:text-gray-300">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="space-y-4">
              <select
                value={selectedUserToInvite}
                onChange={(e) => setSelectedUserToInvite(e.target.value)}
                className="w-full bg-black text-white border border-white rounded px-3 py-2 focus:outline-none"
              >
                <option value="">Select a user to invite</option>
                {availableUsers.map(user => (
                  <option key={user.user_id} value={user.user_id}>{user.username}</option>
                ))}
              </select>
              <button
                onClick={inviteUserToGroup}
                disabled={!selectedUserToInvite || inviteLoading}
                className="w-full bg-white text-black py-2 rounded hover:bg-gray-200 border border-white font-semibold disabled:opacity-50"
              >
                {inviteLoading ? 'Sending...' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invitations Modal */}
      {showInvitationsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-black border border-white p-6 rounded-lg w-96 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Group Invitations</h3>
              <button onClick={() => setShowInvitationsModal(false)} className="text-white hover:text-gray-300">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {invitations.length === 0 ? (
                <p className="text-gray-400">No pending invitations</p>
              ) : (
                invitations.map(invitation => (
                  <div key={invitation.invitation_id} className="p-3 bg-black border border-white rounded">
                    <p className="font-medium text-white">{invitation.group_name}</p>
                    <p className="text-sm text-gray-400">From: {invitation.inviter_username}</p>
                    <div className="flex space-x-2 mt-2">
                      <button
                        onClick={() => respondToInvitation(invitation.invitation_id, 'accept')}
                        className="flex-1 bg-white text-black py-1 rounded hover:bg-gray-200 border border-white font-semibold"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respondToInvitation(invitation.invitation_id, 'decline')}
                        className="flex-1 bg-black text-white py-1 rounded border border-white hover:bg-gray-900 font-semibold"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Context Menu Dropdown */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-black border border-white rounded shadow-lg text-white"
          style={{ top: contextMenu.y, left: contextMenu.x, minWidth: 120 }}
        >
          <button
            className="block w-full text-left px-4 py-2 hover:bg-white hover:text-black rounded"
            onClick={() => {
              if (contextMenu.type === 'conversation' && contextMenu.extra && (contextMenu.extra as Conversation).id) deleteConversation(contextMenu.extra as Conversation);
              if (contextMenu.type === 'message' && contextMenu.extra && ((contextMenu.extra as PrivateMessage).content || (contextMenu.extra as GroupMessage).content)) deleteMessage(contextMenu.extra as PrivateMessage | GroupMessage);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default UnifiedMessages;
