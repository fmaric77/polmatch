"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../../components/Navigation';
import ProfileAvatar from '../../components/ProfileAvatar';
import ProfileModal from '../../components/ProfileModal';

interface User {
  user_id: string;
  username: string;
  display_name?: string;
}

interface Group {
  group_id: string;
  name: string;
  is_private: boolean;
  user_role: string;
}

interface Friend {
  user_id: string;
  friend_id: string;
  status: string;
}

export default function SearchUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<User[]>([]);
  const [actionMessage, setActionMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  
  // Profile separation state
  const [activeProfileType, setActiveProfileType] = useState<'basic' | 'love' | 'business'>('basic');
  const [profileFriends, setProfileFriends] = useState<Friend[]>([]);
  const [profilePendingRequests, setProfilePendingRequests] = useState<Friend[]>([]);

  // Fetch current user ID and validate session
  useEffect(() => {
    async function fetchSession() {
      const res = await fetch('/api/session');
      const data = await res.json();
      if (!data.valid) {
        router.replace('/login');
        return;
      }
      setCurrentUserId(data.user.user_id);
    }
    fetchSession();
  }, [router]);

  useEffect(() => {
    fetchUsers();
    if (currentUserId) {
      fetchProfileFriends();
    }
  }, [currentUserId, activeProfileType]);

  useEffect(() => {
    setFiltered(
      users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.display_name || '').toLowerCase().includes(search.toLowerCase())
      )
    );
  }, [search, users]);

  async function fetchUsers() {
    try {
      const res = await fetch(`/api/users/profile-search?profile_type=${activeProfileType}`);
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch {
      console.error('Failed to fetch users');
    }
  }

  async function fetchProfileFriends() {
    try {
      const res = await fetch(`/api/friends/profile?profile_type=${activeProfileType}`);
      const data = await res.json();
      if (data.success) {
        setProfileFriends(data.friends);
        setProfilePendingRequests([...data.incoming, ...data.outgoing]);
      }
    } catch {
      console.error('Failed to fetch profile friends');
    }
  }

  function isFriend(userId: string): boolean {
    if (!currentUserId) return false;
    return profileFriends.some(friend => 
      (friend.user_id === currentUserId && friend.friend_id === userId) ||
      (friend.user_id === userId && friend.friend_id === currentUserId)
    );
  }

  function hasPendingRequest(userId: string): boolean {
    if (!currentUserId) return false;
    return profilePendingRequests.some(request =>
      (request.user_id === currentUserId && request.friend_id === userId) ||
      (request.user_id === userId && request.friend_id === currentUserId)
    );
  }

  async function sendFriendRequest(friend_id: string) {
    setActionMessage('');
    try {
      const res = await fetch('/api/friends/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id, profile_type: activeProfileType })
      });
      const data = await res.json();
      setActionMessage(data.message);
      if (data.success) {
        fetchProfileFriends(); // Refresh profile-specific friends list
      }
    } catch {
      setActionMessage('Failed to send request');
    }
  }

  async function removeFriend(friend_id: string) {
    setActionMessage('');
    try {
      const res = await fetch('/api/friends/profile/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id, profile_type: activeProfileType })
      });
      const data = await res.json();
      setActionMessage(data.message);
      if (data.success) {
        fetchProfileFriends(); // Refresh profile-specific friends list
      }
    } catch {
      setActionMessage('Failed to remove friend');
    }
  }

  async function handleDirectMessage(user: User) {
    setActionMessage('Starting conversation...');
    try {
      // Create profile-specific conversation
      const res = await fetch('/api/messages/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          receiver_id: user.user_id,
          content: 'Hello!',
          profile_type: activeProfileType
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setActionMessage('Conversation created! Redirecting...');
        // Small delay to ensure database consistency before navigation
        setTimeout(() => {
          window.location.href = `/chat?user=${user.user_id}&profile=${activeProfileType}`;
        }, 500);
      } else {
        setActionMessage('Failed to start conversation: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
      setActionMessage('Failed to start conversation. Please try again.');
    }
  }

  async function fetchUserGroups(): Promise<void> {
    try {
      const res = await fetch('/api/groups/list');
      const data = await res.json();
      if (data.success) {
        // Include all groups where user is a member (since any member can invite)
        setUserGroups(data.groups);
      }
    } catch {
      setActionMessage('Failed to fetch your groups');
    }
  }

  async function handleInviteToGroup(user: User): Promise<void> {
    setSelectedUser(user);
    await fetchUserGroups();
    setShowInviteModal(true);
    setSelectedGroupId('');
  }

  async function sendGroupInvitation(): Promise<void> {
    if (!selectedUser || !selectedGroupId) return;

    setInviteLoading(true);
    setActionMessage('');

    try {
      const res = await fetch(`/api/groups/${selectedGroupId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invited_user_id: selectedUser.user_id })
      });

      const data = await res.json();
      
      if (data.success) {
        setActionMessage(`Invitation sent to ${selectedUser.display_name ? selectedUser.display_name.toUpperCase() : `${activeProfileType} User`}!`);
        setShowInviteModal(false);
        setSelectedUser(null);
        setSelectedGroupId('');
      } else {
        setActionMessage(data.message || 'Failed to send invitation');
      }
    } catch {
      setActionMessage('Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  }

  function closeProfileModal() {
    setIsProfileModalOpen(false);
    setSelectedUser(null);
  }

  function closeInviteModal(): void {
    setShowInviteModal(false);
    setSelectedUser(null);
    setSelectedGroupId('');
  }

  async function addToCatalogue(userId: string) {
    setCatalogueLoading(true);
    setActionMessage('');

    try {
      const res = await fetch('/api/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: userId, 
          category: activeProfileType,
          profile_type: activeProfileType
        })
      });

      const data = await res.json();
      
      if (data.success) {
        setActionMessage('Added to collection successfully');
      } else {
        setActionMessage(data.error || 'Failed to add to collection');
      }
    } catch {
      setActionMessage('Failed to add to collection');
    } finally {
      setCatalogueLoading(false);
    }
  }

  function handleViewProfile(user: User): void {
    setSelectedUser(user);
    setIsProfileModalOpen(true);
  }

  // Exclude current user from results
  const availableUsers = filtered.filter(u => u.user_id !== currentUserId);

  // Category labels matching catalogue style
  const categoryLabels = {
    basic: 'GENERAL',
    love: 'PERSONAL', 
    business: 'CORPORATE'
  };

  const categoryColors = {
    basic: 'bg-gray-900 hover:bg-gray-800 border-gray-700',
    love: 'bg-red-900 hover:bg-red-800 border-red-700',
    business: 'bg-green-900 hover:bg-green-800 border-green-700'
  };

  return (
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="search" />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto mt-2 md:mt-4 lg:mt-8 p-2 md:p-4 lg:p-6 pb-8">
          {/* Header */}
          <div className="bg-black border-2 border-white rounded-none shadow-2xl mb-4 md:mb-6">
            <div className="border-b-2 border-white bg-white text-black p-3 text-center">
              <h1 className="text-lg md:text-2xl font-bold tracking-widest uppercase">Search Users</h1>
            </div>
            <div className="p-3 md:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4 text-center text-xs font-mono mb-4">
                <div>
                  <div className="text-gray-400">SEARCH STATUS</div>
                  <div className="text-lg md:text-xl font-bold">{search ? 'RUNNING' : 'READY'}</div>
                </div>
                <div>
                  <div className="text-gray-400">RESULTS FOUND</div>
                  <div className="text-lg md:text-xl font-bold">{availableUsers.length.toString().padStart(3, '0')}</div>
                </div>
                <div>
                  <div className="text-gray-400">ACCESS LEVEL</div>
                  <div className="text-lg md:text-xl font-bold text-red-400">PUBLIC</div>
                </div>
              </div>
              
              {/* Profile Type Selection */}
              <div className="flex flex-col sm:flex-row justify-center gap-2 mb-4">
                <div className="text-sm font-mono text-gray-400 self-center mb-2 sm:mb-0 sm:mr-4 text-center sm:text-left">SEARCH PROFILE:</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {(Object.keys(categoryLabels) as Array<'basic' | 'love' | 'business'>).map(profileType => (
                    <button
                      key={profileType}
                      onClick={() => setActiveProfileType(profileType)}
                      className={`px-3 md:px-4 py-2 border-2 font-mono text-xs md:text-sm tracking-wider transition-all ${
                        activeProfileType === profileType 
                          ? `${categoryColors[profileType]} text-white`
                          : 'border-gray-600 bg-black text-gray-400 hover:border-gray-400 hover:text-white'
                      }`}
                    >
                      {categoryLabels[profileType]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Input */}
              <div className="mb-4">
                <div className="text-xs font-mono text-gray-400 mb-2 text-center">SEARCH USERS:</div>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="USERNAME OR DISPLAY NAME..."
                  className="w-full p-3 bg-black text-white border-2 border-white font-mono text-sm tracking-wider focus:outline-none focus:border-red-400"
                />
              </div>

              {actionMessage && (
                <div className="mb-4 text-center text-red-400 text-sm font-mono border border-red-400 bg-red-900/20 p-2">
                  ⚠ {actionMessage.toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Search Results Container */}
          <div className="bg-black border-2 border-white rounded-none shadow-2xl">
            {availableUsers.length === 0 && search && (
              <div className="text-center py-8 md:py-12 px-4">
                <div className="font-mono text-gray-400 mb-4 text-sm md:text-base">
                  NO USERS FOUND MATCHING &quot;{search.toUpperCase()}&quot;
                </div>
                <div className="text-xs md:text-sm text-gray-500 font-mono">
                  Try a different search term
                </div>
              </div>
            )}
            {availableUsers.length === 0 && !search && (
              <div className="text-center py-8 md:py-12 px-4">
                <div className="font-mono text-gray-400 mb-4 text-sm md:text-base">
                  SEARCH READY
                </div>
                <div className="text-xs md:text-sm text-gray-500 font-mono">
                  ENTER SEARCH TERMS TO BEGIN
                </div>
              </div>
            )}
            {availableUsers.length > 0 && (
              <div className="p-3 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                  {availableUsers.map((user, index) => (
                    <div key={user.user_id} className="border border-gray-600 bg-gray-900/50 relative">
                      {/* User Header */}
                      <div className="bg-white text-black p-2 font-mono text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold">USER #{(index + 1).toString().padStart(3, '0')}</span>
                          <span className="text-xs">
                            {isFriend(user.user_id) ? 'CONNECTED' : hasPendingRequest(user.user_id) ? 'PENDING' : 'UNCONNECTED'}
                          </span>
                        </div>
                      </div>
                      
                      {/* User Content */}
                      <div className="p-3">
                        <div className="flex flex-col items-center text-center space-y-3">
                          {/* Photo Section */}
                          <div className="border-2 border-white bg-gray-800 p-2">
                            <div className="text-xs font-mono text-gray-400 mb-1 text-center">PHOTO</div>
                            <ProfileAvatar userId={user.user_id} size={64} className="border border-gray-600" />
                          </div>
                          
                          {/* User Details */}
                          <div className="w-full font-mono">
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="text-gray-400">USER NAME:</span>
                                <div className="text-white font-bold tracking-wider">
                                  {user.display_name ? user.display_name.toUpperCase() : `PROFILE-${activeProfileType.toUpperCase()}-USER`}
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-400">RELATIONSHIP:</span>
                                <div className={`font-bold ${
                                  isFriend(user.user_id) ? 'text-green-400' : 
                                  hasPendingRequest(user.user_id) ? 'text-yellow-400' : 'text-red-400'
                                }`}>
                                  {isFriend(user.user_id) ? 'FRIEND' : 
                                   hasPendingRequest(user.user_id) ? 'PENDING' : 'NONE'}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex flex-col gap-2 w-full">
                            <button 
                              onClick={() => handleViewProfile(user)} 
                              className="w-full px-3 py-2 bg-white text-black font-mono text-xs border-2 border-black hover:bg-gray-200 transition-colors tracking-wider"
                            >
                              VIEW PROFILE
                            </button>
                            
                            {isFriend(user.user_id) ? (
                              <button 
                                onClick={() => removeFriend(user.user_id)} 
                                className="w-full px-3 py-2 bg-red-900 text-white font-mono text-xs border-2 border-red-700 hover:bg-red-800 transition-colors tracking-wider"
                              >
                                REMOVE FRIEND
                              </button>
                            ) : hasPendingRequest(user.user_id) ? (
                              <button 
                                disabled 
                                className="w-full px-3 py-2 bg-yellow-800 text-yellow-200 font-mono text-xs border-2 border-yellow-600 cursor-not-allowed tracking-wider"
                              >
                                REQUEST PENDING
                              </button>
                            ) : (
                              <button 
                                onClick={() => sendFriendRequest(user.user_id)} 
                                className="w-full px-3 py-2 bg-green-900 text-white font-mono text-xs border-2 border-green-700 hover:bg-green-800 transition-colors tracking-wider"
                              >
                                ADD FRIEND
                              </button>
                            )}
                            
                            <div className="grid grid-cols-2 gap-2">
                              <button 
                                onClick={() => handleDirectMessage(user)} 
                                className="px-2 py-2 bg-blue-900 text-white font-mono text-xs border-2 border-blue-700 hover:bg-blue-800 transition-colors tracking-wider"
                              >
                                MESSAGE
                              </button>
                              
                              <button 
                                onClick={() => handleInviteToGroup(user)} 
                                className="px-2 py-2 bg-purple-900 text-white font-mono text-xs border-2 border-purple-700 hover:bg-purple-800 transition-colors tracking-wider"
                              >
                                INVITE
                              </button>
                            </div>
                            
                            <button
                              onClick={() => addToCatalogue(user.user_id)}
                              disabled={catalogueLoading}
                              className="w-full px-3 py-2 bg-orange-900 text-white font-mono text-xs border-2 border-orange-700 hover:bg-orange-800 transition-colors tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {catalogueLoading ? 'ADDING...' : 'ADD TO COLLECTION'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Profile Modal */}
        {selectedUser && (
          <ProfileModal
            userId={selectedUser.user_id}
            username={selectedUser.display_name ? selectedUser.display_name.toUpperCase() : `PROFILE-${activeProfileType.toUpperCase()}-USER`}
            isOpen={isProfileModalOpen}
            onClose={closeProfileModal}
            defaultActiveTab={activeProfileType}
            restrictToProfileType={true}
          />
        )}

        {/* Group Invite Modal */}
        {showInviteModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-black border-2 border-white rounded-none shadow-lg w-full max-w-md">
              {/* Modal Header */}
              <div className="border-b-2 border-white bg-white text-black p-3 text-center">
                <h2 className="text-lg font-bold tracking-wider">Invite to Group</h2>
                <div className="font-mono text-xs mt-1">User: {selectedUser.display_name ? selectedUser.display_name.toUpperCase() : `PROFILE-${activeProfileType.toUpperCase()}-USER`}</div>
              </div>
              
              <div className="p-6">
                {userGroups.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="font-mono text-gray-400 mb-4">
                      NO GROUPS AVAILABLE
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      ADMIN OR OWNER PERMISSIONS REQUIRED
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono text-gray-400 mb-2 tracking-wider">
                        SELECT GROUP:
                      </label>
                      <select
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="w-full bg-black text-white border-2 border-white font-mono text-sm px-3 py-2 focus:outline-none focus:border-red-400"
                      >
                        <option value="">CHOOSE GROUP...</option>
                        {userGroups.map(group => (
                          <option key={group.group_id} value={group.group_id}>
                            {group.name.toUpperCase()} {group.is_private ? '[PRIVATE]' : '[PUBLIC]'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                
                <div className="flex space-x-2 mt-6">
                  {userGroups.length > 0 && (
                    <button
                      onClick={sendGroupInvitation}
                      disabled={!selectedGroupId || inviteLoading}
                      className="flex-1 bg-white text-black py-2 font-mono text-xs tracking-wider hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {inviteLoading ? 'SENDING...' : 'SEND INVITATION'}
                    </button>
                  )}
                  <button
                    onClick={closeInviteModal}
                    className="flex-1 bg-red-900 text-white py-2 font-mono text-xs tracking-wider border border-red-700 hover:bg-red-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
