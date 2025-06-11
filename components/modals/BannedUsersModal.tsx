import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faBan, faUndo } from '@fortawesome/free-solid-svg-icons';

interface BannedUser {
  user_id: string;
  username: string;
  banned_at: string;
  banned_by: string;
  banned_by_username: string;
  reason: string;
}

interface BannedUsersModalProps {
  bannedUsers: BannedUser[];
  canManageMembers: boolean;
  selectedConversation: string;
  onUnbanMember: (groupId: string, userId: string) => Promise<void>;
  onClose: () => void;
}

const BannedUsersModal: React.FC<BannedUsersModalProps> = ({
  bannedUsers,
  canManageMembers,
  selectedConversation,
  onUnbanMember,
  onClose
}) => {
  const handleUnbanMember = async (bannedUser: BannedUser): Promise<void> => {
    if (window.confirm(`Unban ${bannedUser.display_name || `AGENT-${bannedUser.user_id.substring(0, 8).toUpperCase()}`}? They will be able to join the group again.`)) {
      try {
        await onUnbanMember(selectedConversation, bannedUser.user_id);
      } catch (error) {
        console.error('Failed to unban member:', error);
      }
    }
  };

  const formatBanDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border border-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <FontAwesomeIcon icon={faBan} className="mr-2" />
            Banned Users ({bannedUsers.length})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {bannedUsers.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              No banned users
            </div>
          ) : (
            <div className="h-full overflow-y-auto space-y-2">
              {bannedUsers.map((bannedUser) => (
                <div
                  key={bannedUser.user_id}
                  className="p-4 rounded border border-gray-700 hover:border-gray-500 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <FontAwesomeIcon icon={faBan} className="text-red-400" />
                        <div>
                          <div className="text-white font-medium">
                            {bannedUser.username}
                          </div>
                          <div className="text-gray-400 text-sm">
                            Banned by {bannedUser.banned_by_username} on {formatBanDate(bannedUser.banned_at)}
                          </div>
                        </div>
                      </div>
                      {bannedUser.reason && (
                        <div className="text-gray-300 text-sm bg-gray-900 p-2 rounded mt-2">
                          <strong>Reason:</strong> {bannedUser.reason}
                        </div>
                      )}
                    </div>
                    
                    {canManageMembers && (
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleUnbanMember(bannedUser)}
                          className="p-2 text-green-400 hover:text-green-300 transition-colors bg-gray-800 hover:bg-gray-700 rounded"
                          title="Unban User"
                        >
                          <FontAwesomeIcon icon={faUndo} size="sm" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="bg-white text-black py-2 px-4 rounded hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BannedUsersModal;
