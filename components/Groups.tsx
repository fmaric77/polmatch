import React, { useEffect, useState, useRef, useCallback } from 'react';
import ProfileAvatar from './ProfileAvatar';

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

interface GroupMessage {
  message_id: string;
  group_id: string;
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

interface User {
  user_id: string;
  username: string;
}

const Groups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [currentUser, setCurrentUser] = useState<{ user_id: string; username: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInvitationsModal, setShowInvitationsModal] = useState(false);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserToInvite, setSelectedUserToInvite] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    topic: '',
    is_private: false
  });
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

  // Fetch user's groups
  const fetchGroups = useCallback(() => {
    fetch('/api/groups/list')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setGroups(data.groups);
        } else {
          setError(data.error || 'Failed to load groups');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load groups');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [refresh, fetchGroups]);

  // Fetch group messages
  const fetchMessages = useCallback(() => {
    if (!selectedGroup) return;
    fetch(`/api/groups/${selectedGroup}/messages`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMessages(data.messages);
        } else {
          setError(data.error || 'Failed to load messages');
        }
      })
      .catch(() => {
        setError('Failed to load messages');
      });
  }, [selectedGroup]);

  // Fetch group members
  const fetchMembers = useCallback(() => {
    if (!selectedGroup) return;
    fetch(`/api/groups/${selectedGroup}/members`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMembers(data.members);
        } else {
          setError(data.error || 'Failed to load members');
        }
      })
      .catch(() => {
        setError('Failed to load members');
      });
  }, [selectedGroup]);

  // Fetch group invitations
  const fetchInvitations = useCallback(() => {
    fetch('/api/invitations')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setInvitations(data.invitations);
        } else {
          setError(data.error || 'Failed to load invitations');
        }
      })
      .catch(() => {
        setError('Failed to load invitations');
      });
  }, []);

  // Fetch available users for invitation
  const fetchAvailableUsers = useCallback(() => {
    fetch('/api/users/available')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAvailableUsers(data.users);
        } else {
          setError(data.error || 'Failed to load users');
        }
      })
      .catch(() => {
        setError('Failed to load users');
      });
  }, []);

  useEffect(() => {
    // Clear previous group data immediately when switching groups
    setMessages([]);
    setMembers([]);
    setError('');
    
    fetchMessages();
    fetchMembers();
    fetchInvitations();
    fetchAvailableUsers();
    // Live update: poll every 3 seconds
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (selectedGroup) {
      intervalRef.current = setInterval(fetchMessages, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedGroup, fetchMessages, fetchMembers, fetchInvitations, fetchAvailableUsers]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newMessage.trim()) return;
    
    const res = await fetch(`/api/groups/${selectedGroup}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newMessage }),
    });
    
    const data = await res.json();
    if (data.success) {
      setNewMessage('');
      fetchMessages(); // Refresh messages immediately
    } else {
      setError(data.error || 'Failed to send message');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.description.trim()) return;
    
    const res = await fetch('/api/groups/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    });
    
    const data = await res.json();
    if (data.success) {
      setCreateForm({ name: '', description: '', topic: '', is_private: false });
      setShowCreateModal(false);
      setRefresh(r => r + 1); // Refresh groups list
    } else {
      setError(data.error || 'Failed to create group');
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    
    const res = await fetch('/api/groups/leave', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId }),
    });
    
    const data = await res.json();
    if (data.success) {
      if (selectedGroup === groupId) {
        setSelectedGroup('');
        setMessages([]);
        setMembers([]);
      }
      setRefresh(r => r + 1); // Refresh groups list
    } else {
      setError(data.error || 'Failed to leave group');
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !selectedUserToInvite) return;
    
    setInviteLoading(true);
    const res = await fetch(`/api/groups/${selectedGroup}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invited_user_id: selectedUserToInvite }),
    });
    
    const data = await res.json();
    setInviteLoading(false);
    if (data.success) {
      setSelectedUserToInvite('');
      setShowInviteModal(false);
      fetchMembers(); // Refresh members list
      fetchInvitations(); // Refresh invitations list
    } else {
      setError(data.error || 'Failed to invite user');
    }
  };

  const handleRespondToInvitation = async (invitationId: string, action: 'accept' | 'decline') => {
    const res = await fetch(`/api/invitations/${invitationId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    
    const data = await res.json();
    if (data.success) {
      fetchInvitations(); // Refresh invitations list
      setRefresh(prev => prev + 1); // Refresh groups list in case user joined a new group
      if (action === 'accept') {
        alert('Invitation accepted! You have joined the group.');
      }
    } else {
      setError(data.error || 'Failed to respond to invitation');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Loading groups...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[80vh] max-w-6xl w-full mx-auto bg-black/80 border border-white rounded-lg shadow-lg mt-8 min-h-[500px]">
      {/* Sidebar: groups list */}
      <div className="w-full md:w-1/3 border-r border-white p-4 overflow-y-auto">
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">My Groups</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  fetchInvitations();
                  setShowInvitationsModal(true);
                }} 
                className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm relative"
              >
                Invitations
                {invitations.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                    {invitations.length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setShowCreateModal(true)} 
                className="p-2 bg-white text-black rounded hover:bg-gray-200 text-sm"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 p-2 bg-red-600 text-white rounded text-sm">
            {error}
          </div>
        )}
        
        <div className="space-y-2">
          {groups.length === 0 ? (
            <div className="text-gray-400 text-center">No groups yet. Create one to get started!</div>
          ) : (
            groups.map(group => (
              <div key={group.group_id} className="relative">
                <button
                  className={`w-full text-left p-3 rounded mb-2 transition-colors ${selectedGroup === group.group_id ? 'bg-white text-black' : 'bg-black/60 text-white hover:bg-white/10'}`}
                  onClick={() => setSelectedGroup(group.group_id)}
                >
                  <div className="font-semibold">{group.name}</div>
                  <div className="text-sm opacity-75">{group.members_count} members</div>
                  <div className="text-xs opacity-60">{group.topic}</div>
                  {group.user_role && (
                    <div className="text-xs font-medium">Role: {group.user_role}</div>
                  )}
                </button>
                {group.user_role !== 'admin' && group.creator_id !== currentUser?.user_id && (
                  <button
                    onClick={() => handleLeaveGroup(group.group_id)}
                    className="absolute top-2 right-2 text-red-400 hover:text-red-200 text-xs"
                    title="Leave group"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-full">
        {selectedGroup ? (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between border-b border-white px-4 py-2 bg-black/70">
              <div className="font-bold text-lg text-white">
                {groups.find(g => g.group_id === selectedGroup)?.name || 'Group Chat'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="p-2 rounded bg-gray-800 text-white hover:bg-gray-700 text-sm"
                  onClick={() => {
                    setShowMembersModal(true);
                    fetchMembers();
                  }}
                  title="View Members"
                >
                  👥 Members ({members.length})
                </button>
                {groups.find(g => g.group_id === selectedGroup)?.is_private && (
                  <button
                    className="p-2 rounded bg-green-600 text-white hover:bg-green-500 text-sm"
                    onClick={() => {
                      fetchAvailableUsers();
                      setShowInviteModal(true);
                    }}
                    title="Invite Users to Private Group"
                  >
                    ➕ Invite
                  </button>
                )}
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-2">
                {messages.length === 0 ? (
                  <div className="text-gray-400 text-center">No messages yet. Start the conversation!</div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.message_id}
                      className={`flex ${msg.sender_id === currentUser?.user_id ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.sender_id !== currentUser?.user_id && (
                        <div className="mr-2 mt-1">
                          <ProfileAvatar userId={msg.sender_id} size={28} />
                        </div>
                      )}
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg shadow text-sm mb-1 ${msg.sender_id === currentUser?.user_id ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}
                      >
                        {msg.sender_id !== currentUser?.user_id && (
                          <div className="font-semibold text-xs mb-1">{msg.sender_username}</div>
                        )}
                        <div>{msg.content}</div>
                        <div className="text-xs opacity-75 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message input */}
            <form onSubmit={handleSendMessage} className="flex gap-2 p-4 border-t border-white bg-black/80">
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
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Select a group to start chatting
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50">
          <div className="bg-black border border-white p-6 rounded max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4 text-white">Create New Group</h2>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <input
                type="text"
                placeholder="Group Name"
                value={createForm.name}
                onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 bg-black text-white border border-white rounded focus:outline-none"
                required
              />
              <textarea
                placeholder="Group Description"
                value={createForm.description}
                onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-2 bg-black text-white border border-white rounded focus:outline-none"
                rows={3}
                required
              />
              <input
                type="text"
                placeholder="Topic (optional)"
                value={createForm.topic}
                onChange={e => setCreateForm(prev => ({ ...prev, topic: e.target.value }))}
                className="w-full p-2 bg-black text-white border border-white rounded focus:outline-none"
              />
              <label className="flex items-center text-white">
                <input
                  type="checkbox"
                  checked={createForm.is_private}
                  onChange={e => setCreateForm(prev => ({ ...prev, is_private: e.target.checked }))}
                  className="mr-2"
                />
                Private Group
              </label>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 p-2 bg-white text-black rounded hover:bg-gray-200">
                  Create Group
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 p-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50">
          <div className="bg-black border border-white p-6 rounded max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4 text-white">Group Members</h2>
            <div className="max-h-60 overflow-y-auto">
              {members.map(member => (
                <div key={member.user_id} className="flex items-center justify-between p-2 border-b border-gray-600">
                  <div className="flex items-center space-x-3">
                    <ProfileAvatar userId={member.user_id} size={32} />
                    <div>
                      <div className="font-semibold text-white">{member.username}</div>
                      <div className="text-sm text-gray-400">Role: {member.role}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    Joined: {new Date(member.join_date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setShowMembersModal(false)}
              className="mt-4 w-full p-2 bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50">
          <div className="bg-black border border-white p-6 rounded max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4 text-white">Invite User to Group</h2>
            <form onSubmit={handleInviteUser} className="space-y-4">
              <select
                value={selectedUserToInvite}
                onChange={e => setSelectedUserToInvite(e.target.value)}
                className="w-full p-2 bg-black text-white border border-white rounded focus:outline-none"
                required
              >
                <option value="">Select a user</option>
                {availableUsers.map(user => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.username}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button 
                  type="submit" 
                  className="flex-1 p-2 bg-white text-black rounded hover:bg-gray-200"
                  disabled={inviteLoading}
                >
                  {inviteLoading ? 'Inviting...' : 'Send Invitation'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 p-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invitations Modal */}
      {showInvitationsModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50">
          <div className="bg-black border border-white p-6 rounded max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4 text-white">Group Invitations</h2>
            <div className="max-h-60 overflow-y-auto">
              {invitations.length === 0 ? (
                <div className="text-gray-400 text-center py-4">No pending invitations</div>
              ) : (
                invitations.map(invite => (
                  <div key={invite.invitation_id} className="flex flex-col gap-2 p-3 border-b border-gray-600">
                    <div>
                      <div className="font-semibold text-white">{invite.group_name}</div>
                      <div className="text-sm text-gray-400">Invited by: {invite.inviter_username}</div>
                      <div className="text-xs text-gray-500">{new Date(invite.created_at).toLocaleDateString()}</div>
                    </div>
                    {invite.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRespondToInvitation(invite.invitation_id, 'accept')}
                          className="flex-1 p-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRespondToInvitation(invite.invitation_id, 'decline')}
                          className="flex-1 p-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <button 
              onClick={() => setShowInvitationsModal(false)}
              className="mt-4 w-full p-2 bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
