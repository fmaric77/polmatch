import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faSearch, faHeart, faBriefcase } from '@fortawesome/free-solid-svg-icons';
import { getAnonymousDisplayName, generateAnonymousId } from '../../lib/anonymization';

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
        return <FontAwesomeIcon icon={faHeart} className="text-red-400" />;
      case 'business':
        return <FontAwesomeIcon icon={faBriefcase} className="text-yellow-400" />;
      default:
        return <FontAwesomeIcon icon={faUser} className="text-green-400" />;
    }
  };

  const getProfileLabel = (profileType: string): string => {
    switch (profileType) {
      case 'love':
        return 'Personal';
      case 'business':
        return 'Corporate';
      default:
        return 'General';
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
          name: getAnonymousDisplayName(selectedUser.display_name, selectedUser.username, selectedUser.user_id),
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
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-black border-2 border-white rounded-none shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* FBI-Style Header */}
        <div className="border-b-2 border-white bg-white text-black p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="font-mono text-xs"></div>
            </div>
            <button
              onClick={onClose}
              className="text-black hover:text-gray-600 transition-colors font-mono text-xl"
            >
              ×
            </button>
          </div>
          <div className="font-mono text-xs mt-1 text-center uppercase tracking-wider">
            Start New Conversation
          </div>
        </div>

        <div className="p-4 space-y-4 flex-1 flex flex-col bg-black text-white">
          {/* Profile Context Info */}
          <div className="bg-gray-900 border border-white p-3 rounded-none">
            <div className="font-mono text-xs text-center uppercase tracking-wider">
              <span className="text-gray-400">Select a user to message</span>
            </div>
          </div>

          {fetchingUsers ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="font-mono text-white uppercase tracking-wider">
                [SCANNING PERSONNEL DATABASE...]
              </div>
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
                  className="w-full bg-black text-white border-2 border-white rounded-none p-2 pl-10 focus:outline-none focus:ring-2 focus:ring-white font-mono uppercase tracking-wider text-xs"
                  disabled={loading}
                />
              </div>

              {/* Users List */}
              <div className="flex-1 min-h-0 border-2 border-white rounded-none p-2 bg-gray-900">
                <div className="h-full overflow-y-auto space-y-1">
                  {filteredUsers.length === 0 ? (
                    <div className="text-gray-400 text-center py-4 font-mono uppercase tracking-wider text-xs">
                      {searchQuery ? 'No matching users' : `No ${getProfileLabel(receiverProfileType)} users available`}
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <button
                        key={user.user_id}
                        onClick={() => handleUserSelect(user)}
                        className={`w-full text-left p-3 rounded-none border transition-colors font-mono ${
                          selectedUser?.user_id === user.user_id
                            ? 'bg-white text-black border-white'
                            : 'bg-transparent text-white border-gray-600 hover:bg-white/10 hover:border-white'
                        }`}
                        disabled={loading}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {getProfileIcon(receiverProfileType)}
                            <div>
                              <div className="font-bold text-xs uppercase tracking-wider">
                                {getAnonymousDisplayName(user.display_name, user.username, user.user_id)}
                              </div>
                              <div className="text-xs opacity-70">ID: {generateAnonymousId(user.user_id)}</div>
                              {user.bio && (
                                <div className="text-xs opacity-70 mt-1">{user.bio}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-xs opacity-50 font-mono uppercase">
                            {user.visibility === 'friends' ? 'ALLIED' : 'PUBLIC'}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Selected User Display */}
              {selectedUser && (
                <div className="bg-gray-900 border border-white rounded-none p-2">
                  <div className="text-white font-mono text-xs uppercase tracking-wider">
                    <span className="text-gray-400">TARGET SELECTED: </span>
                    <span className="font-bold">{getAnonymousDisplayName(selectedUser.display_name, selectedUser.username, selectedUser.user_id)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="text-red-400 font-mono text-xs uppercase tracking-wider border border-red-400 bg-red-900/20 p-2">
              [ERROR: {error.toUpperCase()}]
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 text-white py-2 px-4 rounded-none border-2 border-gray-600 hover:bg-gray-700 hover:border-white transition-colors font-mono uppercase tracking-wider text-xs"
              disabled={loading}
            >
              ABORT
            </button>
            <button
              onClick={handleStartConversation}
              className="flex-1 bg-white text-black py-2 px-4 rounded-none border-2 border-white hover:bg-gray-200 transition-colors disabled:bg-gray-600 disabled:border-gray-600 disabled:cursor-not-allowed font-mono uppercase tracking-wider text-xs font-bold"
              disabled={loading || !selectedUser || fetchingUsers}
            >
              {loading ? 'ESTABLISHING...' : 'ESTABLISH CHANNEL'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewDMModal;