import { useEffect, useState } from 'react';
import ProfileAvatar from './ProfileAvatar';
import ProfileModal from './ProfileModal';
import { profilePictureCache } from '../lib/profilePictureCache';
import { useCSRFToken } from './hooks/useCSRFToken';

type ProfileType = 'basic' | 'love' | 'business';

interface FriendRequest {
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
}

export default function Friends() {
  const { protectedFetch } = useCSRFToken();
  // Profile separation state
  const [activeProfileType, setActiveProfileType] = useState<ProfileType>('basic');
  
  // Profile-specific friends and requests
  const [profileFriends, setProfileFriends] = useState<FriendRequest[]>([]);
  const [profileIncoming, setProfileIncoming] = useState<FriendRequest[]>([]);
  const [profileOutgoing, setProfileOutgoing] = useState<FriendRequest[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  
  // Cache for user display names
  const [userDisplayNames, setUserDisplayNames] = useState<Record<string, string>>({});
  
  // Profile modal state
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    fetchFriends();
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

      // Prefetch profile pictures for all friends and requests
      const allUserIds = [
        ...data.friends.map((f: FriendRequest) => f.user_id === data.user_id ? f.friend_id : f.user_id),
        ...data.incoming.map((req: FriendRequest) => req.user_id),
        ...data.outgoing.map((req: FriendRequest) => req.friend_id)
      ].filter(Boolean);

      if (allUserIds.length > 0) {
        profilePictureCache.prefetchMultiple(allUserIds)
          .catch(err => console.warn('Error prefetching friend profile pictures:', err));
        
        // Fetch display names for all users
        fetchUserDisplayNames(allUserIds);
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('fetchProfileFriends error:', error);
      setError(error.message || 'Failed to fetch profile friends');
    } finally {
      setLoading(false);
    }
  }

  async function fetchUserDisplayNames(userIds: string[]) {
    try {
      const res = await protectedFetch('/api/users/display-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds })
      });
      const data = await res.json();
      if (data.success) {
        setUserDisplayNames(prev => ({ ...prev, ...data.displayNames }));
      }
    } catch (err) {
      console.warn('Failed to fetch user display names:', err);
    }
  }

  async function respondRequest(requester_id: string, action: 'accept' | 'reject') {
    setActionMessage('');
    try {
      const res = await protectedFetch('/api/friends/profile/respond', {
        method: 'POST',
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
      const res = await protectedFetch('/api/friends/profile/remove', {
        method: 'POST',
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

  const getProfileTypeLabel = (type: ProfileType): string => {
    const labels = {
      basic: 'General',
      love: 'Dating', 
      business: 'Business'
    };
    return labels[type];
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white/40 dark:bg-black/40 border border-black/30 dark:border-white/30 rounded-lg mb-6">
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-mono font-bold uppercase tracking-wider">Friends</h1>
            <div className="text-sm font-mono text-gray-600 dark:text-gray-400">
              {profileFriends.length} friends
            </div>
          </div>
          
          {/* Profile Type Selection */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(['basic', 'love', 'business'] as ProfileType[]).map((type) => (
              <button
                key={type}
                onClick={() => setActiveProfileType(type)}
                className={`px-3 py-2 rounded font-mono text-xs uppercase tracking-wider transition-colors ${
                  activeProfileType === type 
                    ? 'bg-black dark:bg-white text-white dark:text-black'
                    : 'bg-white dark:bg-black border border-black dark:border-white text-black dark:text-white hover:bg-gray-100 dark:hover:bg-white/10'
                }`}
              >
                {getProfileTypeLabel(type)}
              </button>
            ))}
          </div>

          {actionMessage && (
            <div className="mb-4 text-center text-red-400 text-sm font-mono bg-red-900/20 border border-red-500/50 rounded p-2">
              {actionMessage}
            </div>
          )}
        </div>
      </div>

      {/* Friends Container */}
      <div className="bg-white/40 dark:bg-black/40 border border-black/30 dark:border-white/30 rounded-lg">
        {loading ? (
          <div className="text-center py-8 px-4">
            <div className="font-mono text-gray-600 dark:text-gray-400 mb-2 text-sm">Loading...</div>
          </div>
        ) : error ? (
          <div className="text-center py-8 px-4">
            <div className="text-red-400 font-mono text-sm">{error}</div>
          </div>
        ) : (
          <div className="p-4">
            {/* Friends List */}
            <div className="mb-6">
              <h3 className="font-mono text-sm font-bold tracking-wider text-black dark:text-white mb-3">
                {getProfileTypeLabel(activeProfileType)} Friends
              </h3>
              {profileFriends.length === 0 ? (
                <div className="text-center py-6">
                  <div className="font-mono text-gray-600 dark:text-gray-400 text-sm">
                    No friends yet
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {profileFriends.map((f) => {
                    const friendId = f.user_id === myId ? f.friend_id : f.user_id;
                    const displayName = userDisplayNames[friendId] || friendId;
                    return (
                      <div key={f.user_id + f.friend_id} className="bg-white/60 dark:bg-black/60 border border-black/20 dark:border-white/20 rounded p-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <ProfileAvatar userId={friendId} size={32} />
                          <div className="font-mono">
                            <button 
                              onClick={() => openProfileModal(friendId, displayName)}
                              className="text-black dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left text-sm font-bold tracking-wider"
                            >
                              {displayName}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={`/messages?user=${friendId}&profile=${activeProfileType}`}
                            className="px-3 py-1 bg-black dark:bg-white text-white dark:text-black font-mono text-xs border border-black dark:border-white hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors rounded"
                          >
                            Message
                          </a>
                          <button 
                            onClick={() => removeFriend(friendId)} 
                            className="px-3 py-1 bg-red-900 text-white font-mono text-xs border border-red-700 hover:bg-red-800 transition-colors rounded"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Incoming Requests */}
            {profileIncoming.length > 0 && (
              <div className="mb-6">
                <h3 className="font-mono text-sm font-bold tracking-wider text-black dark:text-white mb-3">
                  Friend Requests
                </h3>
                <div className="space-y-3">
                  {profileIncoming.map((req) => {
                    const displayName = userDisplayNames[req.user_id] || req.user_id;
                    return (
                      <div key={req.user_id + req.friend_id} className="bg-white/60 dark:bg-black/60 border border-black/20 dark:border-white/20 rounded p-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <ProfileAvatar userId={req.user_id} size={32} />
                          <div className="font-mono">
                            <button 
                              onClick={() => openProfileModal(req.user_id, displayName)}
                              className="text-black dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left text-sm font-bold tracking-wider"
                            >
                              {displayName}
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => respondRequest(req.user_id, 'accept')} 
                            className="px-3 py-1 bg-green-900 text-white font-mono text-xs border border-green-700 hover:bg-green-800 transition-colors rounded"
                          >
                            Accept
                          </button>
                          <button 
                            onClick={() => respondRequest(req.user_id, 'reject')} 
                            className="px-3 py-1 bg-red-900 text-white font-mono text-xs border border-red-700 hover:bg-red-800 transition-colors rounded"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Outgoing Requests */}
            {profileOutgoing.length > 0 && (
              <div className="mb-6">
                <h3 className="font-mono text-sm font-bold tracking-wider text-black dark:text-white mb-3">
                  Sent Requests
                </h3>
                <div className="space-y-3">
                  {profileOutgoing.map((req) => {
                    const displayName = userDisplayNames[req.friend_id] || req.friend_id;
                    return (
                      <div key={req.user_id + req.friend_id} className="bg-white/60 dark:bg-black/60 border border-black/20 dark:border-white/20 rounded p-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <ProfileAvatar userId={req.friend_id} size={32} />
                          <div className="font-mono">
                            <button 
                              onClick={() => openProfileModal(req.friend_id, displayName)}
                              className="text-black dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left text-sm font-bold tracking-wider"
                            >
                              {displayName}
                            </button>
                          </div>
                        </div>
                        <div className="text-yellow-400 font-mono text-xs">
                          Pending
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add Friends */}
            <div>
              <h3 className="font-mono text-sm font-bold tracking-wider text-black dark:text-white mb-3">
                Add Friends
              </h3>
              <div className="text-center py-6">
                <div className="font-mono text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Search for users to add as friends
                </div>
                <a 
                  href="/search" 
                  className="inline-block px-4 py-2 bg-black dark:bg-white text-white dark:text-black font-mono text-sm rounded hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors uppercase tracking-wider"
                >
                  Search Users
                </a>
              </div>
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
