import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUserPlus, faSearch } from '@fortawesome/free-solid-svg-icons';

interface User {
  user_id: string;
  username: string;
  display_name?: string;
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

  // Only show users who have actual profile display names (not fallback to username)
  const usersWithProfiles = availableUsers.filter(user => 
    user.display_name && 
    user.display_name.trim() && 
    user.display_name !== '[NO PROFILE NAME]' &&
    user.display_name !== user.username // Exclude users where display_name equals username (fallback)
  );

  const filteredUsers = usersWithProfiles.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.display_name && user.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
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
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 font-mono">
      <div className="bg-black border-2 border-white rounded-none p-6 w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-green-400 font-mono uppercase tracking-widest text-xs mb-2">INVITE USERS</div>
            <h2 className="text-xl font-mono uppercase tracking-wider text-white flex items-center">
              <FontAwesomeIcon icon={faUserPlus} className="mr-3" />
              INVITE MEMBERS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-black text-red-400 border border-red-400 rounded-none hover:bg-red-400 hover:text-black transition-all shadow-lg font-mono"
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
              placeholder="SEARCH USERS..."
              className="w-full bg-black text-white border-2 border-white rounded-none p-3 pl-10 focus:outline-none focus:border-blue-400 font-mono shadow-lg"
              disabled={loading}
            />
          </div>

          {/* Selected Count */}
          {selectedUsers.size > 0 && (
            <div className="bg-green-600/20 border border-green-400 rounded-none p-2">
              <div className="text-green-400 text-sm font-mono uppercase tracking-wider">
                {selectedUsers.size} USER{selectedUsers.size > 1 ? 'S' : ''} SELECTED
              </div>
            </div>
          )}

          {/* Users List */}
          <div className="flex-1 min-h-0 border-2 border-white rounded-none p-3 bg-black shadow-inner">
            <div className="h-full overflow-y-auto space-y-2">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="bg-black border-2 border-gray-400 rounded-none p-4 shadow-lg">
                    <div className="text-gray-400 font-mono uppercase tracking-wide">
                      {searchQuery ? 'NO MATCHING USERS' : 'NO AVAILABLE USERS'}
                    </div>
                  </div>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() => handleUserToggle(user.user_id)}
                    className={`w-full text-left p-3 rounded-none border-2 transition-all flex items-center justify-between shadow-lg font-mono ${
                      selectedUsers.has(user.user_id)
                        ? 'bg-green-600 border-green-400 text-white shadow-green-400/30'
                        : 'bg-black border-gray-400 hover:border-white text-white'
                    }`}
                    disabled={loading || inviting.has(user.user_id)}
                  >
                    <div className="flex items-center space-x-3">
                      <FontAwesomeIcon icon={faUserPlus} className="text-green-400" />
                      <div>
                        <div className="uppercase tracking-wide">{user.display_name}</div>
                        <div className="text-xs text-gray-400 uppercase tracking-widest">
                          STATUS: {selectedUsers.has(user.user_id) ? 'SELECTED' : 'AVAILABLE'}
                        </div>
                      </div>
                    </div>
                    {inviting.has(user.user_id) && (
                      <div className="text-xs font-mono uppercase tracking-widest text-yellow-400">INVITING...</div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-600/20 border-2 border-red-400 rounded-none p-3">
              <div className="text-red-400 text-sm font-mono uppercase tracking-wide">{error}</div>
            </div>
          )}

          {success && (
            <div className="bg-green-600/20 border-2 border-green-400 rounded-none p-3">
              <div className="text-green-400 text-sm font-mono uppercase tracking-wide">{success}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-black text-gray-400 border-2 border-gray-400 py-3 px-4 rounded-none hover:bg-gray-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wide"
              disabled={loading}
            >
              {selectedUsers.size === 0 ? 'CLOSE' : 'ABORT'}
            </button>
            <button
              onClick={handleInviteSelected}
              className="flex-1 bg-black text-green-400 border-2 border-green-400 py-3 px-4 rounded-none hover:bg-green-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wide disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed"
              disabled={loading || selectedUsers.size === 0}
            >
              {loading ? 'INVITING...' : `INVITE ${selectedUsers.size || ''} USER${selectedUsers.size !== 1 ? 'S' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteModal;