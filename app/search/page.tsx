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
        setActionMessage(`Invitation sent to ${selectedUser.display_name || `AGENT-${selectedUser.user_id.substring(0, 8).toUpperCase()}`}!`);
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
        setActionMessage('Subject added to classified files');
      } else {
        setActionMessage(data.error || 'Failed to add subject to files');
      }
    } catch {
      setActionMessage('Failed to add subject to files');
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
          {/* FBI-Style Header */}
          <div className="bg-black border-2 border-white rounded-none shadow-2xl mb-4 md:mb-6">
            <div className="border-b-2 border-white bg-white text-black p-3 md:p-4 text-center">
              <div className="font-mono text-xs mb-1">CLASSIFIED</div>
              <h1 className="text-lg md:text-2xl font-bold tracking-widest">SUBJECT SEARCH DATABASE</h1>
              <div className="font-mono text-xs mt-1">AUTHORIZED PERSONNEL ONLY</div>
            </div>
            <div className="p-3 md:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4 text-center text-xs font-mono mb-4">
                <div>
                  <div className="text-gray-400">ACTIVE SEARCH</div>
                  <div className="text-lg md:text-xl font-bold">{search ? 'RUNNING' : 'STANDBY'}</div>
                </div>
                <div>
                  <div className="text-gray-400">RESULTS FOUND</div>
                  <div className="text-lg md:text-xl font-bold">{availableUsers.length.toString().padStart(3, '0')}</div>
                </div>
                <div>
                  <div className="text-gray-400">ACCESS LEVEL</div>
                  <div className="text-lg md:text-xl font-bold text-red-400">RESTRICTED</div>
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
                <div className="text-xs font-mono text-gray-400 mb-2 text-center">ENTER SEARCH PARAMETERS:</div>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="SUBJECT USERNAME OR DISPLAY NAME..."
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
                  NO SUBJECTS FOUND MATCHING "{search.toUpperCase()}"
                </div>
                <div className="text-xs md:text-sm text-gray-500 font-mono">
                  REFINE SEARCH PARAMETERS OR CHECK SECURITY CLEARANCE
                </div>
              </div>
            )}
            {availableUsers.length === 0 && !search && (
              <div className="text-center py-8 md:py-12 px-4">
                <div className="font-mono text-gray-400 mb-4 text-sm md:text-base">
                  SEARCH DATABASE READY
                </div>
                <div className="text-xs md:text-sm text-gray-500 font-mono">
                  ENTER SUBJECT IDENTIFIERS TO BEGIN SEARCH
                </div>
              </div>
            )}
            {availableUsers.length > 0 && (
              <div className="p-3 md:p-6">
                <div className="grid gap-3 md:gap-4">
                  {availableUsers.map((user, index) => (
                    <div key={user.user_id} className="border border-gray-600 bg-gray-900/50 relative">
                      {/* File Header */}
                      <div className="bg-white text-black p-2 font-mono text-xs">
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                            <span className="font-bold">SEARCH RESULT #{(index + 1).toString().padStart(3, '0')}</span>
                            <span className="hidden sm:inline">PROFILE: {categoryLabels[activeProfileType]}</span>
                          </div>
                          <div className="text-xs">
                            STATUS: {isFriend(user.user_id) ? 'CONNECTED' : hasPendingRequest(user.user_id) ? 'PENDING' : 'UNCONNECTED'}
                          </div>
                        </div>
                        <div className="sm:hidden text-xs mt-1">
                          PROFILE: {categoryLabels[activeProfileType]}
                        </div>
                      </div>
                      
                      {/* File Content */}
                      <div className="p-3 md:p-4">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                          {/* Subject Info */}
                          <div className="flex flex-col sm:flex-row sm:items-start space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
                            {/* Photo Section */}
                            <div className="border-2 border-white bg-gray-800 p-2 self-center sm:self-start">
                              <div className="text-xs font-mono text-gray-400 mb-1 text-center">PHOTO</div>
                              <ProfileAvatar userId={user.user_id} size={64} className="border border-gray-600" />
                              <div className="text-xs font-mono text-gray-400 mt-1 text-center">ID: {user.user_id.substring(0, 8).toUpperCase()}</div>
                            </div>
                            
                            {/* Subject Details */}
                            <div className="flex-1 font-mono">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2 text-sm">
                                <div>
                                  <span className="text-gray-400">SUBJECT NAME:</span>
                                  <div className="text-white font-bold tracking-wider">
                                    {(user.display_name || `AGENT-${user.user_id.substring(0, 8).toUpperCase()}`).toUpperCase()}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-gray-400">RELATIONSHIP:</span>
                                  <div className={`font-bold ${
                                    isFriend(user.user_id) ? 'text-green-400' : 
                                    hasPendingRequest(user.user_id) ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {isFriend(user.user_id) ? 'ALLIED' : 
                                     hasPendingRequest(user.user_id) ? 'PENDING' : 'UNKNOWN'}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Redacted Information Bar */}
                              <div className="mt-3 p-2 bg-black border border-gray-600">
                                <div className="text-xs text-gray-500 font-mono">
                                  ADDITIONAL DATA: <span className="bg-black text-black border-b border-gray-600">█████████████████████</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex flex-row lg:flex-col gap-2 lg:space-y-2 lg:space-x-0 flex-wrap lg:flex-nowrap lg:ml-4 lg:min-w-[140px]">
                            <button 
                              onClick={() => handleViewProfile(user)} 
                              className="flex-1 lg:flex-none px-3 md:px-4 py-2 bg-white text-black font-mono text-xs border-2 border-black hover:bg-gray-200 transition-colors tracking-wider"
                            >
                              VIEW DOSSIER
                            </button>
                            
                            {isFriend(user.user_id) ? (
                              <button 
                                onClick={() => removeFriend(user.user_id)} 
                                className="flex-1 lg:flex-none px-3 md:px-4 py-2 bg-red-900 text-white font-mono text-xs border-2 border-red-700 hover:bg-red-800 transition-colors tracking-wider"
                              >
                                TERMINATE LINK
                              </button>
                            ) : hasPendingRequest(user.user_id) ? (
                              <button 
                                disabled 
                                className="flex-1 lg:flex-none px-3 md:px-4 py-2 bg-yellow-800 text-yellow-200 font-mono text-xs border-2 border-yellow-600 cursor-not-allowed tracking-wider"
                              >
                                REQUEST PENDING
                              </button>
                            ) : (
                              <button 
                                onClick={() => sendFriendRequest(user.user_id)} 
                                className="flex-1 lg:flex-none px-3 md:px-4 py-2 bg-green-900 text-white font-mono text-xs border-2 border-green-700 hover:bg-green-800 transition-colors tracking-wider"
                              >
                                ESTABLISH LINK
                              </button>
                            )}
                            
                            <button 
                              onClick={() => handleDirectMessage(user)} 
                              className="flex-1 lg:flex-none px-3 md:px-4 py-2 bg-blue-900 text-white font-mono text-xs border-2 border-blue-700 hover:bg-blue-800 transition-colors tracking-wider"
                            >
                              SECURE CHANNEL
                            </button>
                            
                            <button 
                              onClick={() => handleInviteToGroup(user)} 
                              className="flex-1 lg:flex-none px-3 md:px-4 py-2 bg-purple-900 text-white font-mono text-xs border-2 border-purple-700 hover:bg-purple-800 transition-colors tracking-wider"
                            >
                              GROUP RECRUIT
                            </button>
                            
                            <button
                              onClick={() => addToCatalogue(user.user_id)}
                              disabled={catalogueLoading}
                              className="flex-1 lg:flex-none px-3 md:px-4 py-2 bg-orange-900 text-white font-mono text-xs border-2 border-orange-700 hover:bg-orange-800 transition-colors tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {catalogueLoading ? 'FILING...' : 'ADD TO FILES'}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Security Footer */}
                      <div className="bg-red-900 text-white p-1 text-xs font-mono text-center border-t border-red-700">
                        ⚠ CLASSIFIED SEARCH RESULT - AUTHORIZED VIEWING ONLY ⚠
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
            username={selectedUser.display_name || `AGENT-${selectedUser.user_id.substring(0, 8).toUpperCase()}`}
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
                <div className="font-mono text-xs mb-1">CLASSIFIED OPERATION</div>
                <h2 className="text-lg font-bold tracking-wider">GROUP RECRUITMENT</h2>
                <div className="font-mono text-xs mt-1">SUBJECT: {(selectedUser.display_name || `AGENT-${selectedUser.user_id.substring(0, 8).toUpperCase()}`).toUpperCase()}</div>
              </div>
              
              <div className="p-6">
                {userGroups.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="font-mono text-gray-400 mb-4">
                      NO AUTHORIZED GROUPS AVAILABLE
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      ADMINISTRATOR OR OWNER STATUS REQUIRED FOR RECRUITMENT
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-mono text-gray-400 mb-2 tracking-wider">
                        SELECT TARGET GROUP:
                      </label>
                      <select
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="w-full bg-black text-white border-2 border-white font-mono text-sm px-3 py-2 focus:outline-none focus:border-red-400"
                      >
                        <option value="">CHOOSE OPERATION...</option>
                        {userGroups.map(group => (
                          <option key={group.group_id} value={group.group_id}>
                            {group.name.toUpperCase()} {group.is_private ? '[CLASSIFIED]' : '[PUBLIC]'}
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
                      {inviteLoading ? 'TRANSMITTING...' : 'EXECUTE RECRUITMENT'}
                    </button>
                  )}
                  <button
                    onClick={closeInviteModal}
                    className="flex-1 bg-red-900 text-white py-2 font-mono text-xs tracking-wider border border-red-700 hover:bg-red-800 transition-colors"
                  >
                    ABORT MISSION
                  </button>
                </div>
              </div>
              
              {/* Security Footer */}
              <div className="bg-red-900 text-white p-1 text-xs font-mono text-center border-t border-red-700">
                ⚠ CLASSIFIED RECRUITMENT OPERATION ⚠
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
