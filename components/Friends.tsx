import { useEffect, useState } from 'react';
import ProfileAvatar from './ProfileAvatar';
import ProfileModal from './ProfileModal';

interface User {
  user_id: string;
  username: string;
  display_name?: string;
}

interface FriendRequest {
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
}

type ProfileType = 'basic' | 'love' | 'business';

export default function Friends() {
  // Profile separation state
  const [activeProfileType, setActiveProfileType] = useState<ProfileType>('basic');
  
  // Profile-specific friends and requests
  const [profileFriends, setProfileFriends] = useState<FriendRequest[]>([]);
  const [profileIncoming, setProfileIncoming] = useState<FriendRequest[]>([]);
  const [profileOutgoing, setProfileOutgoing] = useState<FriendRequest[]>([]);
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  
  // Profile modal state
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    fetchFriends();
    fetchUsers();
    fetchProfileFriends();
  }, []);

  useEffect(() => {
    fetchProfileFriends();
  }, [activeProfileType]);

  async function fetchFriends() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/friends', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Server error: ${res.status}`);
      }
      if (!data.success) {
        throw new Error(data.message || 'Unknown error');
      }
      setMyId(data.user_id);
      // Note: This function now only sets myId, profile-specific data is handled by fetchProfileFriends
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('fetchFriends error:', error);
      setError(error.message || 'Failed to fetch friends');
    } finally {
      setLoading(false);
    }
  }

  async function fetchProfileFriends() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/friends/profile?profile_type=${activeProfileType}`, { 
        credentials: 'include' 
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Server error: ${res.status}`);
      }
      if (!data.success) {
        throw new Error(data.message || 'Unknown error');
      }
      setMyId(data.user_id);
      setProfileFriends(data.friends);
      setProfileIncoming(data.incoming);
      setProfileOutgoing(data.outgoing);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('fetchProfileFriends error:', error);
      setError(error.message || 'Failed to fetch profile friends');
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users/with-profiles', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch {}
  }

  async function sendRequest(friend_id: string) {
    setActionMessage('');
    try {
      const res = await fetch('/api/friends/profile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id, profile_type: activeProfileType })
      });
      const data = await res.json();
      setActionMessage(data.message);
      fetchProfileFriends();
    } catch {
      setActionMessage('Failed to send request');
    }
  }

  async function respondRequest(requester_id: string, action: 'accept' | 'reject') {
    setActionMessage('');
    try {
      const res = await fetch('/api/friends/profile/respond', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester_id, action, profile_type: activeProfileType })
      });
      const data = await res.json();
      setActionMessage(data.message);
      fetchProfileFriends();
    } catch {
      setActionMessage('Failed to respond');
    }
  }

  async function removeFriend(friend_id: string) {
    setActionMessage('');
    try {
      const res = await fetch('/api/friends/profile/remove', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friend_id, profile_type: activeProfileType })
      });
      const data = await res.json();
      setActionMessage(data.message);
      fetchProfileFriends();
    } catch {
      setActionMessage('Failed to remove friend');
    }
  }

  function openProfileModal(userId: string, username: string): void {
    setSelectedUserId(userId);
    setSelectedUsername(username);
    setIsProfileModalOpen(true);
  }

  function closeProfileModal(): void {
    setIsProfileModalOpen(false);
    setSelectedUserId('');
    setSelectedUsername('');
  }

  // Users not already friends or pending for current profile type
  const availableUsers = users.filter(u =>
    u.user_id !== myId &&
    !profileFriends.some(f => f.user_id === u.user_id || f.friend_id === u.user_id) &&
    !profileOutgoing.some(f => f.friend_id === u.user_id) &&
    !profileIncoming.some(f => f.user_id === u.user_id)
  );

  const getProfileTypeLabel = (type: ProfileType): string => {
    const labels = {
      basic: 'GENERAL',
      love: 'PERSONAL', 
      business: 'CORPORATE'
    };
    return labels[type];
  };

  const categoryColors = {
    basic: 'bg-gray-900 hover:bg-gray-800 border-gray-700',
    love: 'bg-red-900 hover:bg-red-800 border-red-700',
    business: 'bg-green-900 hover:bg-green-800 border-green-700'
  };

  return (
    <>
      {/* FBI-Style Header */}
      <div className="bg-black border-2 border-white rounded-none shadow-2xl mb-4 md:mb-6">
        <div className="border-b-2 border-white bg-white text-black p-3 md:p-4 text-center">
          <div className="font-mono text-xs mb-1">CLASSIFIED</div>
          <h1 className="text-lg md:text-2xl font-bold tracking-widest">CONTACT NETWORK REGISTRY</h1>
          <div className="font-mono text-xs mt-1">AUTHORIZED PERSONNEL ONLY</div>
        </div>
        <div className="p-3 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4 text-center text-xs font-mono mb-4">
            <div>
              <div className="text-gray-400">ACTIVE CONTACTS</div>
              <div className="text-lg md:text-xl font-bold">{profileFriends.length.toString().padStart(3, '0')}</div>
            </div>
            <div>
              <div className="text-gray-400">PENDING REQUESTS</div>
              <div className="text-lg md:text-xl font-bold">{(profileIncoming.length + profileOutgoing.length).toString().padStart(3, '0')}</div>
            </div>
            <div>
              <div className="text-gray-400">CLEARANCE LEVEL</div>
              <div className="text-lg md:text-xl font-bold text-red-400">RESTRICTED</div>
            </div>
          </div>
          
          {/* Profile Type Selection */}
          <div className="flex flex-col sm:flex-row justify-center gap-2 mb-4">
            <div className="text-sm font-mono text-gray-400 self-center mb-2 sm:mb-0 sm:mr-4 text-center sm:text-left">SECURITY LEVEL:</div>
            <div className="flex flex-wrap justify-center gap-2">
              {(['basic', 'love', 'business'] as ProfileType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveProfileType(type)}
                  className={`px-3 md:px-4 py-2 border-2 font-mono text-xs md:text-sm tracking-wider transition-all ${
                    activeProfileType === type 
                      ? `${categoryColors[type]} text-white`
                      : 'border-gray-600 bg-black text-gray-400 hover:border-gray-400 hover:text-white'
                  }`}
                >
                  {getProfileTypeLabel(type)}
                </button>
              ))}
            </div>
          </div>

          {actionMessage && (
            <div className="mb-4 text-center text-red-400 text-sm font-mono border border-red-400 bg-red-900/20 p-2">
              ⚠ {actionMessage.toUpperCase()}
            </div>
          )}
        </div>
      </div>
      {/* Contact Registry Container */}
      <div className="bg-black border-2 border-white rounded-none shadow-2xl">
        {loading ? (
          <div className="text-center py-8 md:py-12 px-4">
            <div className="font-mono text-gray-400 mb-2 text-sm md:text-base">ACCESSING CONTACT REGISTRY...</div>
            <div className="text-red-400 animate-pulse">● ● ●</div>
          </div>
        ) : error ? (
          <div className="text-center py-8 md:py-12 px-4">
            <div className="text-red-400 font-mono text-sm md:text-base">⚠ {error.toUpperCase()}</div>
          </div>
        ) : (
          <div className="p-3 md:p-6">
            {/* Active Contacts Section */}
            <div className="mb-6">
              <div className="border-b border-white pb-2 mb-4">
                <h3 className="font-mono text-sm md:text-base font-bold tracking-wider text-white">
                  ACTIVE {getProfileTypeLabel(activeProfileType)} CONTACTS
                </h3>
              </div>
              {profileFriends.length === 0 ? (
                <div className="text-center py-6">
                  <div className="font-mono text-gray-400 text-xs md:text-sm">
                    NO {getProfileTypeLabel(activeProfileType)} CONTACTS ON RECORD
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {profileFriends.map((f, index) => {
                    const friendId = f.user_id === myId ? f.friend_id : f.user_id;
                    const friendUser = users.find(u => u.user_id === friendId);
                    return (
                      <div key={f.user_id + f.friend_id} className="border border-gray-600 bg-gray-900/50">
                        {/* Contact Header */}
                        <div className="bg-white text-black p-2 font-mono text-xs flex justify-between">
                          <span className="font-bold">CONTACT #{(index + 1).toString().padStart(3, '0')}</span>
                          <span>LEVEL: {getProfileTypeLabel(activeProfileType)}</span>
                        </div>
                        
                        {/* Contact Content */}
                        <div className="p-3 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="border-2 border-white bg-gray-800 p-1">
                              <ProfileAvatar userId={friendId} size={32} className="border border-gray-600" />
                            </div>
                            <div className="font-mono">
                              <button 
                                onClick={() => openProfileModal(friendId, friendUser?.display_name || `AGENT-${friendId.substring(0, 8).toUpperCase()}`)}
                                className="text-white hover:text-blue-400 transition-colors text-left text-sm font-bold tracking-wider"
                              >
                                {(friendUser?.display_name || `AGENT-${friendId.substring(0, 8).toUpperCase()}`).toUpperCase()}
                              </button>
                              <div className="text-xs text-gray-400">ID: {friendId.substring(0, 8).toUpperCase()}</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => removeFriend(friendId)} 
                            className="px-3 py-1 bg-red-900 text-white font-mono text-xs border border-red-700 hover:bg-red-800 transition-colors tracking-wider"
                          >
                            TERMINATE LINK
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Incoming Requests Section */}
            <div className="mb-6">
              <div className="border-b border-white pb-2 mb-4">
                <h3 className="font-mono text-sm md:text-base font-bold tracking-wider text-white">
                  INCOMING {getProfileTypeLabel(activeProfileType)} CLEARANCE REQUESTS
                </h3>
              </div>
              {profileIncoming.length === 0 ? (
                <div className="text-center py-6">
                  <div className="font-mono text-gray-400 text-xs md:text-sm">
                    NO INCOMING {getProfileTypeLabel(activeProfileType)} REQUESTS
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {profileIncoming.map((req, index) => {
                    const fromUser = users.find(u => u.user_id === req.user_id);
                    return (
                      <div key={req.user_id + req.friend_id} className="border border-gray-600 bg-gray-900/50">
                        {/* Request Header */}
                        <div className="bg-yellow-900 text-white p-2 font-mono text-xs flex justify-between border-b border-yellow-700">
                          <span className="font-bold">REQUEST #{(index + 1).toString().padStart(3, '0')}</span>
                          <span>STATUS: PENDING</span>
                        </div>
                        
                        {/* Request Content */}
                        <div className="p-3 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="border-2 border-white bg-gray-800 p-1">
                              <ProfileAvatar userId={req.user_id} size={32} className="border border-gray-600" />
                            </div>
                            <div className="font-mono">
                              <button 
                                onClick={() => openProfileModal(req.user_id, fromUser?.display_name || `AGENT-${req.user_id.substring(0, 8).toUpperCase()}`)}
                                className="text-white hover:text-blue-400 transition-colors text-left text-sm font-bold tracking-wider"
                              >
                                {(fromUser?.display_name || `AGENT-${req.user_id.substring(0, 8).toUpperCase()}`).toUpperCase()}
                              </button>
                              <div className="text-xs text-gray-400">ID: {req.user_id.substring(0, 8).toUpperCase()}</div>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button 
                              onClick={() => respondRequest(req.user_id, 'accept')} 
                              className="px-3 py-1 bg-green-900 text-white font-mono text-xs border border-green-700 hover:bg-green-800 transition-colors tracking-wider"
                            >
                              APPROVE
                            </button>
                            <button 
                              onClick={() => respondRequest(req.user_id, 'reject')} 
                              className="px-3 py-1 bg-red-900 text-white font-mono text-xs border border-red-700 hover:bg-red-800 transition-colors tracking-wider"
                            >
                              DENY
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Outgoing Requests Section */}
            <div className="mb-6">
              <div className="border-b border-white pb-2 mb-4">
                <h3 className="font-mono text-sm md:text-base font-bold tracking-wider text-white">
                  OUTGOING {getProfileTypeLabel(activeProfileType)} CLEARANCE REQUESTS
                </h3>
              </div>
              {profileOutgoing.length === 0 ? (
                <div className="text-center py-6">
                  <div className="font-mono text-gray-400 text-xs md:text-sm">
                    NO OUTGOING {getProfileTypeLabel(activeProfileType)} REQUESTS
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {profileOutgoing.map((req, index) => {
                    const toUser = users.find(u => u.user_id === req.friend_id);
                    return (
                      <div key={req.user_id + req.friend_id} className="border border-gray-600 bg-gray-900/50">
                        {/* Request Header */}
                        <div className="bg-blue-900 text-white p-2 font-mono text-xs flex justify-between border-b border-blue-700">
                          <span className="font-bold">SENT #{(index + 1).toString().padStart(3, '0')}</span>
                          <span>STATUS: AWAITING RESPONSE</span>
                        </div>
                        
                        {/* Request Content */}
                        <div className="p-3 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="border-2 border-white bg-gray-800 p-1">
                              <ProfileAvatar userId={req.friend_id} size={32} className="border border-gray-600" />
                            </div>
                            <div className="font-mono">
                              <button 
                                onClick={() => openProfileModal(req.friend_id, toUser?.display_name || `AGENT-${req.friend_id.substring(0, 8).toUpperCase()}`)}
                                className="text-white hover:text-blue-400 transition-colors text-left text-sm font-bold tracking-wider"
                              >
                                {(toUser?.display_name || `AGENT-${req.friend_id.substring(0, 8).toUpperCase()}`).toUpperCase()}
                              </button>
                              <div className="text-xs text-gray-400">ID: {req.friend_id.substring(0, 8).toUpperCase()}</div>
                            </div>
                          </div>
                          <div className="text-yellow-400 font-mono text-xs tracking-wider">
                            PENDING APPROVAL
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* Add New Contacts Section */}
            <div>
              <div className="border-b border-white pb-2 mb-4">
                <h3 className="font-mono text-sm md:text-base font-bold tracking-wider text-white">
                  ESTABLISH NEW {getProfileTypeLabel(activeProfileType)} CONTACT
                </h3>
              </div>
              {availableUsers.length === 0 ? (
                <div className="text-center py-6">
                  <div className="font-mono text-gray-400 text-xs md:text-sm">
                    NO SUBJECTS AVAILABLE FOR {getProfileTypeLabel(activeProfileType)} CONTACT
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableUsers.map((u, index) => (
                    <div key={u.user_id} className="border border-gray-600 bg-gray-900/50">
                      {/* Subject Header */}
                      <div className="bg-white text-black p-2 font-mono text-xs flex justify-between">
                        <span className="font-bold">SUBJECT #{(index + 1).toString().padStart(3, '0')}</span>
                        <span>CLEARANCE: UNVERIFIED</span>
                      </div>
                      
                      {/* Subject Content */}
                      <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="border-2 border-white bg-gray-800 p-1">
                            <ProfileAvatar userId={u.user_id} size={32} className="border border-gray-600" />
                          </div>
                          <div className="font-mono">
                            <button 
                              onClick={() => openProfileModal(u.user_id, u.display_name || `AGENT-${u.user_id.substring(0, 8).toUpperCase()}`)}
                              className="text-white hover:text-blue-400 transition-colors text-left text-sm font-bold tracking-wider"
                            >
                              {(u.display_name || `AGENT-${u.user_id.substring(0, 8).toUpperCase()}`).toUpperCase()}
                            </button>
                            <div className="text-xs text-gray-400">ID: {u.user_id.substring(0, 8).toUpperCase()}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => sendRequest(u.user_id)} 
                          className="px-3 py-1 bg-white text-black font-mono text-xs border-2 border-black hover:bg-gray-200 transition-colors tracking-wider"
                        >
                          INITIATE CONTACT
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Profile Modal */}
      <ProfileModal
        userId={selectedUserId}
        username={selectedUsername}
        isOpen={isProfileModalOpen}
        onClose={closeProfileModal}
        defaultActiveTab={activeProfileType}
        restrictToProfileType={true}
      />
    </>
  );
}
