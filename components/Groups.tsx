import React, { useEffect, useState, useRef, useCallback } from 'react';
import ProfileAvatar from './ProfileAvatar';
import { getAnonymousDisplayName } from '../lib/anonymization';
import { useCSRFToken } from './hooks/useCSRFToken';

type ProfileType = 'basic' | 'love' | 'business';

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
  profile_type?: ProfileType;
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
  profile_type?: ProfileType;
}

interface GroupMember {
  user_id: string;
  username: string;
  display_name?: string;
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
  display_name?: string;
}

interface PollOption { option_id: string; text: string; }
interface Poll { poll_id: string; question: string; options: PollOption[]; }
interface PollVote { _id: string; count: number; }
interface PollResult { votes: PollVote[]; userVote: string | null; }

const Groups = () => {
  const { protectedFetch } = useCSRFToken();
  // Profile separation state
  const [activeProfileType, setActiveProfileType] = useState<ProfileType>('basic');
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [refresh, setRefresh] = useState<number>(0);
  const [currentUser, setCurrentUser] = useState<{ user_id: string; username: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showMembersModal, setShowMembersModal] = useState<boolean>(false);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [showInvitationsModal, setShowInvitationsModal] = useState<boolean>(false);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserToInvite, setSelectedUserToInvite] = useState<string>('');
  const [inviteLoading, setInviteLoading] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    topic: '',
    is_private: false,
    profile_type: 'basic' as ProfileType
  });
  const [showPollModal, setShowPollModal] = useState<boolean>(false);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollResults, setPollResults] = useState<Record<string, PollResult>>({});
  const [newPollQuestion, setNewPollQuestion] = useState<string>('');
  const [newPollOptions, setNewPollOptions] = useState<string[]>(['', '']);
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

  // Fetch user's groups with profile filtering
  const fetchGroups = useCallback(() => {
    fetch(`/api/groups/list?profile_type=${activeProfileType}`)
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
  }, [activeProfileType]);

  useEffect(() => {
    fetchGroups();
  }, [refresh, fetchGroups]);

  // Fetch group messages with profile type
  const fetchMessages = useCallback(() => {
    if (!selectedGroup) return;
    fetch(`/api/groups/${selectedGroup}/messages?profile_type=${activeProfileType}`)
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
  }, [selectedGroup, activeProfileType]);

  // Fetch group members
  const fetchMembers = useCallback(() => {
    if (!selectedGroup) return;
    fetch(`/api/groups/${selectedGroup}/members?profile_type=${activeProfileType}`)
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
  }, [selectedGroup, activeProfileType]);

  // Fetch group invitations
  const fetchInvitations = useCallback(() => {
    fetch(`/api/invitations?profile_type=${activeProfileType}`)
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
  }, [activeProfileType]);

  // Fetch available users for invitation
  const fetchAvailableUsers = useCallback(() => {
    if (!selectedGroup) return;
    
    fetch(`/api/users/available?group_id=${selectedGroup}&profile_type=${activeProfileType}`)
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
  }, [selectedGroup, activeProfileType]);

  const fetchPolls = useCallback(async () => {
    if (!selectedGroup) return;
    const res = await fetch(`/api/groups/${selectedGroup}/polls`);
    const data = await res.json();
    if (data.success) {
      setPolls(data.polls as Poll[]);
      const results: Record<string, PollResult> = {};
      await Promise.all(data.polls.map(async (p: Poll) => {
        const r = await fetch(`/api/groups/${selectedGroup}/polls/${p.poll_id}/votes`);
        const d = await r.json();
        if (d.success) results[p.poll_id] = { votes: d.votes, userVote: d.userVote };
      }));
      setPollResults(results);
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (showPollModal) fetchPolls();
  }, [showPollModal, fetchPolls]);

  useEffect(() => {
    // Clear previous group data immediately when switching groups
    setMessages([]);
    setMembers([]);
    setError('');
    
    fetchMessages();
    fetchMembers();
    fetchInvitations();
    // Only fetch available users when a group is selected and for invite functionality
    // Not on every group change to prevent excessive API calls
    
    // Live update: poll every 3 seconds
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (selectedGroup) {
      intervalRef.current = setInterval(fetchMessages, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedGroup, currentUser, fetchMembers, fetchInvitations, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update create form profile type when activeProfileType changes
  useEffect(() => {
    setCreateForm(prev => ({
      ...prev,
      profile_type: activeProfileType
    }));
  }, [activeProfileType]);

  // Refresh invitations when profile type changes
  useEffect(() => {
    fetchInvitations();
  }, [activeProfileType, fetchInvitations]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newMessage.trim()) return;
    
    const res = await fetch(`/api/groups/${selectedGroup}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        content: newMessage,
        profile_type: activeProfileType
      }),
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
      body: JSON.stringify({
        ...createForm,
        profile_type: activeProfileType
      }),
    });
    
    const data = await res.json();
    if (data.success) {
      setCreateForm({ 
        name: '', 
        description: '', 
        topic: '', 
        is_private: false,
        profile_type: activeProfileType 
      });
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
      body: JSON.stringify({ 
        group_id: groupId,
        profile_type: activeProfileType
      }),
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
      body: JSON.stringify({ 
        invited_user_id: selectedUserToInvite,
        profile_type: activeProfileType
      }),
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
      body: JSON.stringify({ 
        action,
        profile_type: activeProfileType 
      }),
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

  // Poll handling functions
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const opts = newPollOptions.filter(o => o.trim());
    if (!newPollQuestion.trim() || opts.length < 2) return;
    const res = await protectedFetch(`/api/groups/${selectedGroup}/polls`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ question: newPollQuestion, options: opts })
    });
    const data = await res.json();
    if (data.success) {
      setNewPollQuestion(''); setNewPollOptions(['','']);
      fetchPolls();
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    const res = await protectedFetch(`/api/groups/${selectedGroup}/polls/${pollId}/votes`, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ optionId })
    });
    if ((await res.json()).success) fetchPolls();
  };

  // Member management functions
  const handleRemoveMember = async (memberId: string, memberUsername: string) => {
    if (!selectedGroup) return;
    if (!window.confirm(`Are you sure you want to remove ${memberUsername} from the group?`)) return;
    
    try {
      const res = await fetch(`/api/groups/${selectedGroup}/members/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: memberId,
          profile_type: activeProfileType
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchMembers(); // Refresh members list
        alert('Member removed successfully');
      } else {
        alert(data.error || 'Failed to remove member');
      }
    } catch {
      alert('Failed to remove member');
    }
  };

  const handleBanMember = async (memberId: string, memberUsername: string) => {
    if (!selectedGroup) return;
    const reason = prompt(`Enter reason for banning ${memberUsername} (optional):`);
    if (reason === null) return; // User cancelled
    
    try {
      const res = await fetch(`/api/groups/${selectedGroup}/members/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: memberId, 
          reason,
          profile_type: activeProfileType
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchMembers(); // Refresh members list
        alert('Member banned successfully');
      } else {
        alert(data.error || 'Failed to ban member');
      }
    } catch {
      alert('Failed to ban member');
    }
  };

  const handleUpdateMemberRole = async (memberId: string, memberUsername: string, newRole: 'admin' | 'member') => {
    if (!selectedGroup) return;
    const action = newRole === 'admin' ? 'promote' : 'demote';
    if (!window.confirm(`Are you sure you want to ${action} ${memberUsername} ${newRole === 'admin' ? 'to admin' : 'to member'}?`)) return;
    
    try {
      const res = await fetch(`/api/groups/${selectedGroup}/members/${memberId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          role: newRole,
          profile_type: activeProfileType
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchMembers(); // Refresh members list
        alert(`Member ${action}d successfully`);
      } else {
        alert(data.error || `Failed to ${action} member`);
      }
    } catch {
      alert(`Failed to ${action} member`);
    }
  };

  // Helper function to check if current user can manage members
  const canManageMembers = (selectedGroup: string): boolean => {
    if (!currentUser) return false;
    const group = groups.find(g => g.group_id === selectedGroup);
    if (!group) return false;
    
    // Check if user is creator
    if (group.creator_id === currentUser.user_id) return true;
    
    // Check if user has admin role
    return group.user_role === 'admin' || group.user_role === 'owner';
  };

  // Helper function to check if a member can be managed by current user
  const canManageMember = (member: GroupMember, selectedGroup: string): boolean => {
    if (!currentUser || !canManageMembers(selectedGroup)) return false;
    
    const group = groups.find(g => g.group_id === selectedGroup);
    if (!group) return false;
    
    // Can't manage yourself
    if (member.user_id === currentUser.user_id) return false;
    
    // Can't manage the group creator
    if (group.creator_id === member.user_id) return false;
    
    // If current user is not the creator, they can't manage other admins
    if (group.creator_id !== currentUser.user_id && (member.role === 'admin' || member.role === 'owner')) {
      return false;
    }
    
    return true;
  };

  // Check if current user can promote members to admin (only owners can promote)
  const canPromoteToAdmin = (selectedGroup: string): boolean => {
    if (!currentUser || !selectedGroup) return false;
    
    const group = groups.find(g => g.group_id === selectedGroup);
    if (!group) return false;
    
    // Find current user's membership in this group
    const currentUserMember = members.find(m => m.user_id === currentUser.user_id);
    if (!currentUserMember) return false;
    
    // Only owners can promote to admin
    return currentUserMember.role === 'owner';
  };

  // Helper function to get profile label
  const getProfileLabel = (profileType: ProfileType): string => {
    switch (profileType) {
      case 'love':
        return 'Dating';
      case 'business':
        return 'Business';
      default:
        return 'General';
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
          
          {/* Profile Type Switcher - moved to match direct messages position */}
          <div className="mb-4">
            <div className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-wider">Profile Type:</div>
            <div className="flex gap-1 p-1 bg-gray-800 border border-white rounded-none">
              {(['basic', 'love', 'business'] as ProfileType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    console.log(`🔄 Switching to ${type} profile type for groups`);
                    setActiveProfileType(type);
                    setSelectedGroup('');
                    setMessages([]);
                    setMembers([]);
                    setError('');
                    // Force refresh groups for the new profile type
                    setRefresh(r => r + 1);
                  }}
                  className={`flex-1 px-2 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                    activeProfileType === type
                      ? 'bg-white text-black font-bold'
                      : 'bg-transparent text-white hover:bg-white/20'
                  }`}
                >
                  {type === 'basic' ? 'GENERAL' : type === 'love' ? 'DATING' : 'BUSINESS'}
                </button>
              ))}
            </div>
          </div>
          
          {/* Active Profile Indicator */}
          <div className="text-xs text-gray-400 font-mono">
            Viewing {getProfileLabel(activeProfileType).toLowerCase()} profile groups
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
                <button
                  className="p-2 rounded bg-purple-600 text-white hover:bg-purple-500 text-sm"
                  onClick={() => {
                    setShowPollModal(true);
                    fetchPolls();
                  }}
                  title="View and Create Polls"
                >
                  📊 Polls
                </button>
                <button
                  className="p-2 rounded bg-green-600 text-white hover:bg-green-500 text-sm"
                  onClick={() => {
                    fetchAvailableUsers();
                    setShowInviteModal(true);
                  }}
                  title="Invite Users to Group"
                >
                  ➕ Invite
                </button>
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
                        className={`max-w-sm px-4 py-2 rounded-lg shadow text-sm mb-1 break-words ${msg.sender_id === currentUser?.user_id ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}
                      >
                        {msg.sender_id !== currentUser?.user_id && (
                          <div className="font-semibold text-xs mb-1">{msg.sender_display_name || '[NO PROFILE NAME]'}</div>
                        )}
                        <div className="break-words">{msg.content}</div>
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
          <div className="bg-black border border-white p-6 rounded max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            <h2 className="text-2xl font-bold mb-4 text-white">Group Members</h2>
            <div className="flex-1 overflow-y-auto space-y-1">
              {members.map(member => (
                <div key={member.user_id} className="flex flex-col p-3 border-b border-gray-600 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <ProfileAvatar userId={member.user_id} size={32} />
                      <div>
                        <div className="font-semibold text-white">{getAnonymousDisplayName(member.display_name, member.username, member.user_id)}</div>
                        <div className="text-sm text-gray-400">Role: {member.role}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      Joined: {new Date(member.join_date).toLocaleDateString()}
                    </div>
                  </div>
                  
                  {/* Admin Actions */}
                  {selectedGroup && canManageMembers(selectedGroup) && canManageMember(member, selectedGroup) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {/* Promote/Demote buttons */}
                      {member.role === 'member' && canPromoteToAdmin(selectedGroup) && (
                        <button
                          onClick={() => handleUpdateMemberRole(member.user_id, member.username, 'admin')}
                          className="px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700 transition-colors"
                          title={`Promote ${member.username} to admin`}
                        >
                          ⬆️ Promote
                        </button>
                      )}
                      {member.role === 'admin' && (
                        <button
                          onClick={() => handleUpdateMemberRole(member.user_id, member.username, 'member')}
                          className="px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 transition-colors"
                          title={`Demote ${member.username} to member`}
                        >
                          ⬇️ Demote
                        </button>
                      )}
                      
                      {/* Kick button */}
                      <button
                        onClick={() => handleRemoveMember(member.user_id, member.username)}
                        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                        title={`Remove ${member.username} from group`}
                      >
                        👢 Kick
                      </button>
                      
                      {/* Ban button */}
                      <button
                        onClick={() => handleBanMember(member.user_id, member.username)}
                        className="px-2 py-1 bg-red-800 text-white rounded text-xs hover:bg-red-900 transition-colors"
                        title={`Ban ${member.username} from group`}
                      >
                        🚫 Ban
                      </button>
                    </div>
                  )}
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
                    {getAnonymousDisplayName(user.display_name, user.username, user.user_id)}
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

      {/* Polls Modal */}
      {showPollModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-black border border-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Group Polls</h2>
            <button onClick={() => setShowPollModal(false)} className="absolute top-4 right-4 text-white">✕</button>

            {/* Create Poll Form */}
            <form onSubmit={handleCreatePoll} className="mb-6">
              <input value={newPollQuestion} onChange={e => setNewPollQuestion(e.target.value)}
                placeholder="Poll question" className="w-full p-2 bg-gray-800 text-white border border-white rounded mb-2" required />
              {newPollOptions.map((opt, idx) => (
                <input key={idx} value={opt} onChange={e => {
                  const arr = [...newPollOptions]; arr[idx] = e.target.value; setNewPollOptions(arr);
                }} placeholder={`Option ${idx+1}`} className="w-full p-2 bg-gray-800 text-white border border-white rounded mb-2" required />
              ))}
              <button type="button" onClick={() => setNewPollOptions([...newPollOptions, ''])}
                className="text-sm text-blue-400 mb-4">+ Add Option</button>
              <button type="submit" className="px-4 py-2 bg-white text-black rounded hover:bg-gray-200">Create Poll</button>
            </form>

            {/* Polls List */}
            <div className="space-y-4">
              {polls.map(poll => (
                <div key={poll.poll_id} className="bg-gray-900 p-4 rounded border border-gray-700">
                  <div className="text-white font-medium mb-2">{poll.question}</div>
                  <div className="space-y-2">
                    {poll.options.map(opt => {
                      const result = pollResults[poll.poll_id];
                      const count = result?.votes.find(v => v._id === opt.option_id)?.count || 0;
                      const isVoted = result?.userVote === opt.option_id;
                      return (
                        <div key={opt.option_id} className="flex items-center justify-between">
                          <button onClick={() => handleVote(poll.poll_id, opt.option_id)}
                            disabled={!!result?.userVote}
                            className={`flex-1 text-left p-2 rounded ${isVoted ? 'bg-green-600 text-white' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
                          >{opt.text}</button>
                          <span className="text-gray-400 text-sm ml-2">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
