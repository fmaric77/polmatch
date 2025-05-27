import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUsers, faCrown, faUserShield, faUser } from '@fortawesome/free-solid-svg-icons';

interface GroupMember {
  user_id: string;
  username: string;
  role: string;
  join_date: string;
}

interface MembersModalProps {
  groupMembers: GroupMember[];
  onMemberContextMenu: (e: React.MouseEvent, member: GroupMember) => void;
  canManageMembers: boolean;
  onClose: () => void;
}

const MembersModal: React.FC<MembersModalProps> = ({
  groupMembers,
  onMemberContextMenu,
  canManageMembers,
  onClose
}) => {
  const getRoleIcon = (role: string): React.ReactElement => {
    switch (role) {
      case 'owner':
        return <FontAwesomeIcon icon={faCrown} className="text-yellow-400" />;
      case 'admin':
        return <FontAwesomeIcon icon={faUserShield} className="text-blue-400" />;
      default:
        return <FontAwesomeIcon icon={faUser} className="text-gray-400" />;
    }
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'owner':
        return 'text-yellow-400';
      case 'admin':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  const formatJoinDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  // Sort members by role priority (owner > admin > member)
  const sortedMembers = [...groupMembers].sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, member: 2 };
    const aOrder = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
    const bOrder = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }
    
    // If same role, sort alphabetically by username
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border border-white rounded-lg p-6 w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center">
            <FontAwesomeIcon icon={faUsers} className="mr-2" />
            Group Members ({groupMembers.length})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          {groupMembers.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              No members found
            </div>
          ) : (
            <div className="h-full overflow-y-auto space-y-2">
              {sortedMembers.map((member) => (
                <div
                  key={member.user_id}
                  className={`p-3 rounded border border-gray-700 hover:border-gray-500 transition-colors ${
                    canManageMembers && member.role !== 'owner' ? 'cursor-context-menu' : ''
                  }`}
                  onContextMenu={(e) => canManageMembers && member.role !== 'owner' ? onMemberContextMenu(e, member) : undefined}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getRoleIcon(member.role)}
                      <div>
                        <div className="text-white font-medium">
                          {member.username}
                        </div>
                        <div className={`text-sm capitalize ${getRoleColor(member.role)}`}>
                          {member.role}
                        </div>
                      </div>
                    </div>
                    <div className="text-gray-400 text-sm">
                      Joined {formatJoinDate(member.join_date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canManageMembers && (
          <div className="mt-4 text-gray-400 text-xs text-center">
            Right-click on members to manage them
          </div>
        )}

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

export default MembersModal;