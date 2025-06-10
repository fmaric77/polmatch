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
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
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

  async function fetchFriends() {
    try {
      const res = await fetch('/api/friends');
      const data = await res.json();
      if (data.success) {
        setFriends(data.friends);
        setPendingRequests([...data.incoming, ...data.outgoing]);
      }
    } catch {}
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
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id })
      });
      const data = await res.json();
      setActionMessage(data.message);
      if (data.success) {
        fetchFriends(); // Refresh friends list
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
        // Only include groups where user can invite (admin/owner)
        const inviteableGroups = data.groups.filter((group: Group) => 
          group.user_role === 'owner' || group.user_role === 'admin'
        );
        setUserGroups(inviteableGroups);
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
        setActionMessage(`Invitation sent to ${selectedUser.display_name || selectedUser.username}!`);
        setShowInviteModal(false);
        setSelectedUser(null);
        setSelectedGroupId('');
      } else {
        setActionMessage(data.error || 'Failed to send invitation');
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

  async function handleAddToCatalogue(user: User): Promise<void> {
    setCatalogueLoading(true);
    setActionMessage('');

    try {
      const res = await fetch('/api/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: user.user_id, 
          category: activeProfileType,
          profile_type: activeProfileType
        })
      });

      const data = await res.json();
      
      if (data.success) {
        setActionMessage(data.message);
      } else {
        setActionMessage(data.error || 'Failed to add to catalogue');
      }
    } catch {
      setActionMessage('Failed to add to catalogue');
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

  return (
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="search" />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="w-full max-w-4xl mx-auto mt-4 md:mt-12 p-4 md:p-8">
          <div className="bg-black/80 border border-white rounded-lg shadow-lg p-4 md:p-8">
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Search Users</h2>
            
            {/* Profile Type Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-white">Select Profile Type:</h3>
              <div className="flex space-x-2">
                {[
                  { value: 'basic', label: 'Basic', color: 'bg-blue-600 hover:bg-blue-700' },
                  { value: 'love', label: 'Love', color: 'bg-pink-600 hover:bg-pink-700' },
                  { value: 'business', label: 'Business', color: 'bg-green-600 hover:bg-green-700' }
                ].map(profileType => (
                  <button
                    key={profileType.value}
                    onClick={() => setActiveProfileType(profileType.value as 'basic' | 'love' | 'business')}
                    className={`px-4 py-2 rounded text-white font-medium transition-colors ${
                      activeProfileType === profileType.value 
                        ? profileType.color.replace('hover:', '') + ' ring-2 ring-white'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {profileType.label}
                  </button>
                ))}
              </div>
              <p className="text-gray-400 text-sm mt-2">
                You are searching as your <span className="capitalize font-semibold">{activeProfileType}</span> profile. 
                Friend requests and messages will be sent from this profile type.
              </p>
            </div>
            
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by username or display name..."
              className="w-full p-3 mb-4 md:mb-6 bg-black text-white border border-white rounded focus:outline-none text-sm md:text-base"
            />
            {actionMessage && (
              <div className="mb-4 text-center text-green-400 text-sm md:text-base px-2">
                {actionMessage}
              </div>
            )}
            <div className="space-y-4">
              {availableUsers.map(user => (
                <div key={user.user_id} className="border-b border-gray-700 pb-4 last:border-b-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    {/* User Info */}
                    <div className="flex items-center space-x-3 min-w-0 flex-shrink">
                      <ProfileAvatar userId={user.user_id} size={40} />
                      <span className="text-sm md:text-base truncate font-medium">
                        {user.display_name || user.username || user.user_id}
                      </span>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:gap-2">
                      <button 
                        onClick={() => handleViewProfile(user)} 
                        className="flex-1 sm:flex-none px-3 py-2 bg-indigo-600 text-white rounded text-xs md:text-sm hover:bg-indigo-700 transition-colors whitespace-nowrap"
                      >
                        View Profile
                      </button>
                      {isFriend(user.user_id) ? (
                        <button 
                          onClick={() => removeFriend(user.user_id)} 
                          className="flex-1 sm:flex-none px-3 py-2 bg-red-600 text-white rounded text-xs md:text-sm hover:bg-red-700 transition-colors whitespace-nowrap"
                        >
                          Remove Friend
                        </button>
                      ) : hasPendingRequest(user.user_id) ? (
                        <button 
                          disabled
                          className="flex-1 sm:flex-none px-3 py-2 bg-gray-600 text-white rounded text-xs md:text-sm cursor-not-allowed transition-colors whitespace-nowrap"
                        >
                          Request Pending
                        </button>
                      ) : (
                        <button 
                          onClick={() => sendFriendRequest(user.user_id)} 
                          className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 text-white rounded text-xs md:text-sm hover:bg-blue-700 transition-colors whitespace-nowrap"
                        >
                          Add {activeProfileType.charAt(0).toUpperCase() + activeProfileType.slice(1)} Friend
                        </button>
                      )}
                      <button 
                        onClick={() => handleDirectMessage(user)} 
                        className="flex-1 sm:flex-none px-3 py-2 bg-green-600 text-white rounded text-xs md:text-sm hover:bg-green-700 transition-colors whitespace-nowrap"
                      >
                        Message ({activeProfileType.charAt(0).toUpperCase() + activeProfileType.slice(1)})
                      </button>
                      <button 
                        onClick={() => handleInviteToGroup(user)} 
                        className="flex-1 sm:flex-none px-3 py-2 bg-purple-600 text-white rounded text-xs md:text-sm hover:bg-purple-700 transition-colors whitespace-nowrap"
                      >
                        Invite
                      </button>
                      <button 
                        onClick={() => handleAddToCatalogue(user)} 
                        disabled={catalogueLoading}
                        className="flex-1 sm:flex-none px-3 py-2 bg-yellow-600 text-white rounded text-xs md:text-sm hover:bg-yellow-700 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {catalogueLoading ? 'Adding...' : `Catalogue (${activeProfileType.charAt(0).toUpperCase() + activeProfileType.slice(1)})`}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {availableUsers.length === 0 && search && (
                <div className="text-center text-gray-400 py-8">
                  <p className="text-sm md:text-base">No users found matching &quot;{search}&quot;</p>
                </div>
              )}
              {availableUsers.length === 0 && !search && (
                <div className="text-center text-gray-400 py-8">
                  <p className="text-sm md:text-base">Start typing to search for users</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Modal */}
        {selectedUser && (
          <ProfileModal
            userId={selectedUser.user_id}
            username={selectedUser.display_name || selectedUser.username}
            isOpen={isProfileModalOpen}
            onClose={closeProfileModal}
            defaultActiveTab={activeProfileType}
            restrictToProfileType={true}
          />
        )}

        {/* Group Invite Modal */}
        {showInviteModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-black border border-white rounded-lg shadow-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4 text-white">
                Invite {selectedUser.display_name || selectedUser.username} to Group
              </h2>
              
              {userGroups.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-400 mb-4">
                    You don&apos;t have any groups where you can invite users.
                  </p>
                  <p className="text-sm text-gray-500">
                    You need to be an admin or owner of a group to send invitations.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Select a group:
                    </label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full bg-black text-white border border-white rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
                    >
                      <option value="">Choose a group...</option>
                      {userGroups.map(group => (
                        <option key={group.group_id} value={group.group_id}>
                          {group.name} {group.is_private ? '(Private)' : '(Public)'}
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
                    className="flex-1 bg-white text-black py-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {inviteLoading ? 'Sending...' : 'Send Invitation'}
                  </button>
                )}
                <button
                  onClick={closeInviteModal}
                  className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
