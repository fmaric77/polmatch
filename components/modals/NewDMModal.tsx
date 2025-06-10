import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUser, faSearch } from '@fortawesome/free-solid-svg-icons';

interface User {
  user_id: string;
  username: string;
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
  users: User[];
  onClose: () => void;
  onSuccess: (conversation: Conversation) => void;
  profileType?: 'basic' | 'love' | 'business';
}

const NewDMModal: React.FC<NewDMModalProps> = ({
  users,
  onClose,
  onSuccess,
  profileType
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      // Use profile-specific API if profileType is provided
      const apiUrl = profileType ? '/api/private-conversations/profile' : '/api/private-conversations';
      const requestBody = profileType 
        ? { other_user_id: selectedUser.user_id, profile_type: profileType }
        : { other_user_id: selectedUser.user_id };

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();

      if (data.success) {
        const conversation: Conversation = profileType && data.conversation
          ? data.conversation
          : {
              id: selectedUser.user_id,
              name: selectedUser.username,
              type: 'direct'
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
          <h2 className="text-xl font-bold text-white flex items-center">
            <FontAwesomeIcon icon={faUser} className="mr-2" />
            New {profileType ? `${profileType.charAt(0).toUpperCase() + profileType.slice(1)} ` : ''}Direct Message
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="space-y-4 flex-1 flex flex-col">
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
                  {searchQuery ? 'No users found' : 'No users available'}
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() => handleUserSelect(user)}
                    className={`w-full text-left p-2 rounded transition-colors ${
                      selectedUser?.user_id === user.user_id
                        ? 'bg-white text-black'
                        : 'hover:bg-gray-800 text-white'
                    }`}
                    disabled={loading}
                  >
                    <div className="flex items-center">
                      <FontAwesomeIcon icon={faUser} className="mr-2" />
                      {user.username}
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
                Selected: <span className="font-medium">{selectedUser.username}</span>
              </div>
            </div>
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
              disabled={loading || !selectedUser}
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