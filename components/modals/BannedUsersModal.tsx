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
    if (window.confirm(`Unban ${bannedUser.username || `AGENT-${bannedUser.user_id.substring(0, 8).toUpperCase()}`}? They will be able to join the group again.`)) {
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
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 font-mono">
      <div className="bg-black border-2 border-white rounded-none p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-red-500 font-mono uppercase tracking-widest text-xs mb-2">TERMINATION RECORDS</div>
            <h2 className="text-xl font-mono uppercase tracking-wider text-white flex items-center">
              <FontAwesomeIcon icon={faBan} className="mr-3" />
              TERMINATED AGENTS ({bannedUsers.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-black text-red-400 border border-red-400 rounded-none hover:bg-red-400 hover:text-black transition-all shadow-lg font-mono"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {bannedUsers.length === 0 ? (
            <div className="text-center py-8">
              <div className="bg-black border-2 border-gray-400 rounded-none p-6 shadow-lg">
                <div className="text-gray-400 font-mono uppercase tracking-wide">NO TERMINATION RECORDS</div>
                <div className="text-xs text-gray-500 mt-2 font-mono uppercase tracking-widest">ALL AGENTS REMAIN ACTIVE</div>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto space-y-3">
              {bannedUsers.map((bannedUser) => (
                <div
                  key={bannedUser.user_id}
                  className="p-4 bg-black border-2 border-red-400 rounded-none hover:border-red-300 transition-all shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2 bg-red-600/20 border border-red-400 rounded-none">
                          <FontAwesomeIcon icon={faBan} className="text-red-400" />
                        </div>
                        <div>
                          <div className="text-white font-mono uppercase tracking-wide">
                            AGENT-{bannedUser.username}
                          </div>
                          <div className="text-gray-400 text-sm font-mono uppercase tracking-widest">
                            TERMINATED BY: AGENT-{bannedUser.banned_by_username} | {formatBanDate(bannedUser.banned_at)}
                          </div>
                        </div>
                      </div>
                      {bannedUser.reason && (
                        <div className="bg-black border border-gray-500 rounded-none p-3 mt-3 shadow-inner">
                          <div className="text-red-400 text-xs font-mono uppercase tracking-widest mb-1">TERMINATION REASON:</div>
                          <div className="text-gray-300 text-sm font-mono">{bannedUser.reason}</div>
                        </div>
                      )}
                    </div>
                    
                    {canManageMembers && (
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleUnbanMember(bannedUser)}
                          className="p-3 bg-black text-green-400 border-2 border-green-400 rounded-none hover:bg-green-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wide"
                          title="REINSTATE AGENT"
                        >
                          <FontAwesomeIcon icon={faUndo} size="sm" className="mr-2" />
                          REINSTATE
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="bg-black text-white border-2 border-white py-3 px-6 rounded-none hover:bg-white hover:text-black transition-all shadow-lg font-mono uppercase tracking-wider"
          >
            CLOSE RECORDS
          </button>
        </div>
      </div>
    </div>
  );
};

export default BannedUsersModal;
