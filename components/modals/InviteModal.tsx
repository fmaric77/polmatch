import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUserPlus, faSearch } from '@fortawesome/free-solid-svg-icons';

interface User {
  user_id: string;
  username: string;
}

interface InviteModalProps {
  availableUsers: User[];
  onClose: () => void;
  onInvite: (userId: string) => Promise<boolean>;
  onFetchUsers: () => void;
}

const InviteModal: React.FC<InviteModalProps> = ({
  availableUsers,
  onClose,
  onInvite,
  onFetchUsers
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch available users when modal opens (only once)
  useEffect(() => {
    onFetchUsers();
  }, []); // Empty dependency array to run only once when modal opens

  const filteredUsers = availableUsers.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUserToggle = (userId: string): void => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
    if (error) setError('');
  };

  const handleInviteSelected = async (): Promise<void> => {
    if (selectedUsers.size === 0) {
      setError('Please select at least one user to invite');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    
    const usersToInvite = Array.from(selectedUsers);
    let successCount = 0;
    let failCount = 0;

    for (const userId of usersToInvite) {
      setInviting(prev => new Set(prev).add(userId));
      
      try {
        const success = await onInvite(userId);
        if (success) {
          successCount++;
          setSelectedUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
      
      setInviting(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }

    setLoading(false);

    if (successCount > 0 && failCount === 0) {
      setSuccess(`Successfully invited ${successCount} user${successCount > 1 ? 's' : ''}`);
      // Refresh the available users list
      setTimeout(() => {
        onFetchUsers();
      }, 1000);
    } else if (successCount > 0 && failCount > 0) {
      setSuccess(`Invited ${successCount} user${successCount > 1 ? 's' : ''}, ${failCount} failed`);
      setTimeout(() => {
        onFetchUsers();
      }, 1000);
    } else {
      setError(`Failed to invite ${failCount} user${failCount > 1 ? 's' : ''}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border border-white rounded-lg p-6 w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <FontAwesomeIcon icon={faUserPlus} className="mr-2" />
            Invite Users
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

          {/* Selected Count */}
          {selectedUsers.size > 0 && (
            <div className="text-white text-sm">
              {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
            </div>
          )}

          {/* Users List */}
          <div className="flex-1 min-h-0 border border-white rounded p-2">
            <div className="h-full overflow-y-auto space-y-1">
              {filteredUsers.length === 0 ? (
                <div className="text-gray-400 text-center py-4">
                  {searchQuery ? 'No users found' : 'No users available to invite'}
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() => handleUserToggle(user.user_id)}
                    className={`w-full text-left p-2 rounded transition-colors flex items-center justify-between ${
                      selectedUsers.has(user.user_id)
                        ? 'bg-white text-black'
                        : 'hover:bg-gray-800 text-white'
                    }`}
                    disabled={loading || inviting.has(user.user_id)}
                  >
                    <div className="flex items-center">
                      <FontAwesomeIcon icon={faUserPlus} className="mr-2" />
                      {user.username}
                    </div>
                    {inviting.has(user.user_id) && (
                      <div className="text-xs">Inviting...</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          {success && (
            <div className="text-green-400 text-sm">{success}</div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 text-white py-2 px-4 rounded hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              {selectedUsers.size === 0 ? 'Close' : 'Cancel'}
            </button>
            <button
              onClick={handleInviteSelected}
              className="flex-1 bg-white text-black py-2 px-4 rounded hover:bg-gray-200 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
              disabled={loading || selectedUsers.size === 0}
            >
              {loading ? 'Inviting...' : `Invite ${selectedUsers.size || ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;