import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faBan, faUndo } from '@fortawesome/free-solid-svg-icons';
import { getAnonymousDisplayName } from '../../lib/anonymization';
import { useTheme } from '../ThemeProvider';

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
  const { theme } = useTheme();
  const handleUnbanMember = async (bannedUser: BannedUser): Promise<void> => {
    if (window.confirm(`Unban ${getAnonymousDisplayName(bannedUser.username, bannedUser.username, bannedUser.user_id)}? They will be able to join the group again.`)) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`w-full max-w-md ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-h-[80vh] flex flex-col`}>
        <div className={`p-6 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Banned Users
            </h2>
            <button
              onClick={onClose}
              className={`${theme === 'dark' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {bannedUsers.length === 0 ? (
            <div className="text-center py-8">
              <div className={`${theme === 'dark' ? 'bg-black border-gray-400' : 'bg-gray-50 border-gray-300'} border-2 rounded-none p-6 shadow-lg`}>
                <div className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} font-mono uppercase tracking-wide`}>NO BANNED USERS</div>
                <div className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'} mt-2 font-mono uppercase tracking-widest`}>ALL MEMBERS REMAIN ACTIVE</div>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto space-y-3">
              {bannedUsers.map((bannedUser) => (
                <div
                  key={bannedUser.user_id}
                  className={`p-4 ${theme === 'dark' ? 'bg-black border-red-400 hover:border-red-300' : 'bg-gray-50 border-red-500 hover:border-red-400'} border-2 rounded-none transition-all shadow-lg`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`p-2 ${theme === 'dark' ? 'bg-red-600/20 border-red-400' : 'bg-red-100 border-red-500'} border rounded-none`}>
                          <FontAwesomeIcon icon={faBan} className={theme === 'dark' ? 'text-red-400' : 'text-red-600'} />
                        </div>
                        <div>
                          <div className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'} font-mono uppercase tracking-wide`}>
                            {getAnonymousDisplayName(bannedUser.username, bannedUser.username, bannedUser.user_id)}
                          </div>
                          <div className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-sm font-mono uppercase tracking-widest`}>
                            BANNED BY: {bannedUser.banned_by_username} | {formatBanDate(bannedUser.banned_at)}
                          </div>
                        </div>
                      </div>
                      {bannedUser.reason && (
                        <div className={`${theme === 'dark' ? 'bg-black border-gray-500' : 'bg-gray-100 border-gray-400'} border rounded-none p-3 mt-3 shadow-inner`}>
                          <div className={`${theme === 'dark' ? 'text-red-400' : 'text-red-600'} text-xs font-mono uppercase tracking-widest mb-1`}>BAN REASON:</div>
                          <div className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} text-sm font-mono`}>{bannedUser.reason}</div>
                        </div>
                      )}
                    </div>
                    
                    {canManageMembers && (
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleUnbanMember(bannedUser)}
                          className={`p-3 ${theme === 'dark' ? 'bg-black text-green-400 border-green-400 hover:bg-green-400 hover:text-black' : 'bg-white text-green-600 border-green-600 hover:bg-green-600 hover:text-white'} border-2 rounded-none transition-all shadow-lg font-mono uppercase tracking-wide`}
                          title="UNBAN MEMBER"
                        >
                          <FontAwesomeIcon icon={faUndo} size="sm" className="mr-2" />
                          UNBAN
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
