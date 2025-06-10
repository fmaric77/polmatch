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
  
  // Legacy global state (for backwards compatibility)
  const [friends, setFriends] = useState<FriendRequest[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  
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
      setFriends(data.friends);
      setIncoming(data.incoming);
      setOutgoing(data.outgoing);
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
      const res = await fetch('/api/users/list', { credentials: 'include' });
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
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-black text-white rounded-lg border border-white mt-8">
      <h2 className="text-2xl font-bold mb-4">Friends & Requests</h2>
      
      {/* Profile Type Selection */}
      <div className="mb-6">
        <h3 className="font-semibold mb-3">Profile Type</h3>
        <div className="flex space-x-2">
          {(['basic', 'love', 'business'] as ProfileType[]).map((type) => (
            <button
              key={type}
              onClick={() => setActiveProfileType(type)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                activeProfileType === type
                  ? 'bg-white text-black border-white'
                  : 'bg-black text-white border-white hover:bg-white/10'
              }`}
            >
              {getProfileTypeLabel(type)}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-400 mt-2">
          Manage friends for your {getProfileTypeLabel(activeProfileType)} profile
        </p>
      </div>
      
      {actionMessage && <div className="mb-4 text-center text-green-400">{actionMessage}</div>}
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : (
        <>
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Your {getProfileTypeLabel(activeProfileType)} Friends</h3>
            {profileFriends.length === 0 ? (
              <div className="text-gray-400">No {activeProfileType} friends yet.</div>
            ) : (
              <ul className="space-y-2">
                {profileFriends.map(f => {
                  // Determine the ID of the friend (the one that's not myId)
                  const friendId = f.user_id === myId ? f.friend_id : f.user_id;
                  const friendUser = users.find(u => u.user_id === friendId);
                  return (
                    <li key={f.user_id + f.friend_id} className="flex justify-between items-center border-b border-gray-700 pb-2">
                      <div className="flex items-center space-x-3">
                        <ProfileAvatar userId={friendId} size={32} />
                        <button 
                          onClick={() => openProfileModal(friendId, friendUser?.username || friendId)}
                          className="text-white hover:text-blue-400 transition-colors text-left"
                        >
                          {friendUser?.display_name || friendUser?.username || friendUser?.user_id}
                        </button>
                      </div>
                      <button 
                        onClick={() => removeFriend(friendId)} 
                        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                      >
                        Remove {getProfileTypeLabel(activeProfileType)} Friend
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Incoming {getProfileTypeLabel(activeProfileType)} Friend Requests</h3>
            {profileIncoming.length === 0 ? (
              <div className="text-gray-400">No incoming {activeProfileType} requests.</div>
            ) : (
              <ul className="space-y-2">
                {profileIncoming.map(req => {
                  const fromUser = users.find(u => u.user_id === req.user_id);
                  return (
                    <li key={req.user_id + req.friend_id} className="flex justify-between items-center border-b border-gray-700 pb-2">
                      <div className="flex items-center space-x-3">
                        <ProfileAvatar userId={req.user_id} size={32} />
                        <button 
                          onClick={() => openProfileModal(req.user_id, fromUser?.username || req.user_id)}
                          className="text-white hover:text-blue-400 transition-colors text-left"
                        >
                          {fromUser?.display_name || fromUser?.username || fromUser?.user_id}
                        </button>
                      </div>
                      <span>
                        <button 
                          onClick={() => respondRequest(req.user_id, 'accept')} 
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 mr-2"
                        >
                          Accept ({getProfileTypeLabel(activeProfileType)})
                        </button>
                        <button 
                          onClick={() => respondRequest(req.user_id, 'reject')} 
                          className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                        >
                          Reject
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Outgoing {getProfileTypeLabel(activeProfileType)} Friend Requests</h3>
            {profileOutgoing.length === 0 ? (
              <div className="text-gray-400">No outgoing {activeProfileType} requests.</div>
            ) : (
              <ul className="space-y-2">
                {profileOutgoing.map(req => {
                  const toUser = users.find(u => u.user_id === req.friend_id);
                  return (
                    <li key={req.user_id + req.friend_id} className="flex justify-between items-center border-b border-gray-700 pb-2">
                      <div className="flex items-center space-x-3">
                        <ProfileAvatar userId={req.friend_id} size={32} />
                        <button 
                          onClick={() => openProfileModal(req.friend_id, toUser?.username || req.friend_id)}
                          className="text-white hover:text-blue-400 transition-colors text-left"
                        >
                          {toUser?.display_name || toUser?.username || toUser?.user_id}
                        </button>
                      </div>
                      <span className="text-yellow-400 text-xs">Pending ({getProfileTypeLabel(activeProfileType)})</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-semibold mb-2">Add New {getProfileTypeLabel(activeProfileType)} Friend</h3>
            {availableUsers.length === 0 ? (
              <div className="text-gray-400">No users available to add as {activeProfileType} friends.</div>
            ) : (
              <ul className="space-y-2">
                {availableUsers.map(u => (
                  <li key={u.user_id} className="flex justify-between items-center border-b border-gray-700 pb-2">
                    <div className="flex items-center space-x-3">
                      <ProfileAvatar userId={u.user_id} size={32} />
                      <button 
                        onClick={() => openProfileModal(u.user_id, u.username || u.user_id)}
                        className="text-white hover:text-blue-400 transition-colors text-left"
                      >
                        {u.display_name || u.username || u.user_id}
                      </button>
                    </div>
                    <button 
                      onClick={() => sendRequest(u.user_id)} 
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    >
                      Add {getProfileTypeLabel(activeProfileType)} Friend
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      
      {/* Profile Modal */}
      <ProfileModal
        userId={selectedUserId}
        username={selectedUsername}
        isOpen={isProfileModalOpen}
        onClose={closeProfileModal}
        defaultActiveTab={activeProfileType}
        restrictToProfileType={true}
      />
    </div>
  );
}
