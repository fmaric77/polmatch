import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUser, faSearch, faHeart, faBriefcase } from '@fortawesome/free-solid-svg-icons';

interface User {
  user_id: string;
  username: string;
  display_name?: string;
  bio?: string;
  profile_picture_url?: string;
  visibility: string;
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
  user_id?: string;
  creator_id?: string;
  user_role?: string;
}

interface NewDMModalProps {
  onClose: () => void;
  onSuccess: (conversation: Conversation) => void;
  senderProfileType: 'basic' | 'love' | 'business';
  receiverProfileType: 'basic' | 'love' | 'business';
}

const NewDMModal: React.FC<NewDMModalProps> = ({
  onClose,
  onSuccess,
  senderProfileType,
  receiverProfileType
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [fetchingUsers, setFetchingUsers] = useState(true);

  // Fetch users with the specified receiver profile type
  useEffect(() => {
    const fetchUsers = async (): Promise<void> => {
      setFetchingUsers(true);
      setError('');
      
      try {
        const response = await fetch(
          `/api/users/discover?profile_type=${receiverProfileType}&sender_profile_type=${senderProfileType}`
        );
        const data = await response.json();
        
        if (data.success) {
          setUsers(data.users);
        } else {
          setError(data.message || 'Failed to load users');
        }
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users');
      } finally {
        setFetchingUsers(false);
      }
    };

    fetchUsers();
  }, [receiverProfileType, senderProfileType]);

  const getProfileIcon = (profileType: string): React.ReactElement => {
    switch (profileType) {
      case 'love':
        return <FontAwesomeIcon icon={faHeart} className="text-pink-400" />;
      case 'business':
        return <FontAwesomeIcon icon={faBriefcase} className="text-green-400" />;
      default:
        return <FontAwesomeIcon icon={faUser} className="text-blue-400" />;
    }
  };

  const getProfileLabel = (profileType: string): string => {
    switch (profileType) {
      case 'love':
        return 'Love';
      case 'business':
        return 'Business';
      default:
        return 'Basic';
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartConversation = async (): Promise<void> => {
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/private-conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          other_user_id: selectedUser.user_id,
          sender_profile_type: senderProfileType,
          receiver_profile_type: receiverProfileType
        })
      });

      const data = await res.json();

      if (data.success) {
        const conversation: Conversation = {
          id: selectedUser.user_id,
          name: `${selectedUser.display_name || selectedUser.username} (${getProfileLabel(senderProfileType)} ↔ ${getProfileLabel(receiverProfileType)})`,
          type: 'direct',
          user_id: selectedUser.user_id
        };
        onSuccess(conversation);
      } else {
        setError(data.error || data.message || 'Failed to start conversation');
      }
    } catch (err) {
      console.error('Error starting conversation:', err);
      setError('Failed to start conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user: User): void => {
    setSelectedUser(user);
    if (error) setError('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border border-white rounded-lg p-6 w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            {getProfileIcon(senderProfileType)}
            <h2 className="text-xl font-bold text-white">
              New {getProfileLabel(senderProfileType)} → {getProfileLabel(receiverProfileType)} Message
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="space-y-4 flex-1 flex flex-col">
          {/* Profile Context Info */}
          <div className="bg-gray-800 rounded p-3 text-center">
            <div className="text-sm text-gray-300">
              <span>You as </span>
              <span className="font-medium text-white">{getProfileLabel(senderProfileType)}</span>
              <span> → Connecting with </span>
              <span className="font-medium text-white">{getProfileLabel(receiverProfileType)} profiles</span>
            </div>
          </div>

          {fetchingUsers ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-white">Loading users...</div>
            </div>
          ) : (
            <>
              {/* Search Input */}
              <div className="relative">
                <FontAwesomeIcon 
                  icon={faSearch} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users..."
                  className="w-full bg-black text-white border border-white rounded p-2 pl-10 focus:outline-none focus:ring-1 focus:ring-white"
                  disabled={loading}
                />
              </div>

              {/* Users List */}
              <div className="flex-1 min-h-0 border border-white rounded p-2">
                <div className="h-full overflow-y-auto space-y-1">
                  {filteredUsers.length === 0 ? (
                    <div className="text-gray-400 text-center py-4">
                      {searchQuery ? 'No users found' : `No ${getProfileLabel(receiverProfileType).toLowerCase()} profiles available`}
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <button
                        key={user.user_id}
                        onClick={() => handleUserSelect(user)}
                        className={`w-full text-left p-3 rounded transition-colors ${
                          selectedUser?.user_id === user.user_id
                            ? 'bg-white text-black'
                            : 'hover:bg-gray-800 text-white'
                        }`}
                        disabled={loading}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getProfileIcon(receiverProfileType)}
                            <div>
                              <div className="font-medium">
                                {user.display_name || user.username}
                              </div>
                              {user.display_name && (
                                <div className="text-xs opacity-70">@{user.username}</div>
                              )}
                              {user.bio && (
                                <div className="text-xs opacity-70 mt-1">{user.bio}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-xs opacity-50">
                            {user.visibility === 'friends' ? '👥 Friends' : '🌍 Public'}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Selected User Display */}
              {selectedUser && (
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-white text-sm">
                    Selected: <span className="font-medium">{selectedUser.display_name || selectedUser.username}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleStartConversation}
              className="flex-1 bg-white text-black py-2 px-4 rounded hover:bg-gray-200 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              disabled={loading || !selectedUser || fetchingUsers}
            >
              {loading ? 'Starting...' : 'Start Conversation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewDMModal;