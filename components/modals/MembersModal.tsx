import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUsers, faCrown, faUserShield, faUser, faUserPlus, faUserMinus, faUserTimes, faBan } from '@fortawesome/free-solid-svg-icons';

interface GroupMember {
  user_id: string;
  username: string;
  role: string;
  join_date: string;
}

interface MembersModalProps {
  groupMembers: GroupMember[];
  canManageMembers: boolean;
  currentUser: { user_id: string; username: string; is_admin?: boolean } | null;
  selectedConversation: string;
  onPromoteToAdmin: (groupId: string, userId: string) => Promise<void>;
  onDemoteToMember: (groupId: string, userId: string) => Promise<void>;
  onKickMember: (groupId: string, userId: string) => Promise<void>;
  onBanMember: (groupId: string, userId: string) => Promise<void>;
  onClose: () => void;
}

const MembersModal: React.FC<MembersModalProps> = ({
  groupMembers,
  canManageMembers,
  currentUser,
  selectedConversation,
  onPromoteToAdmin,
  onDemoteToMember,
  onKickMember,
  onBanMember,
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

  const canManageMember = (member: GroupMember): boolean => {
    if (!canManageMembers || !currentUser) return false;
    if (member.user_id === currentUser.user_id) return false; // Can't manage yourself
    if (member.role === 'owner') return false; // Can't manage owner
    
    // Only owners and admins can manage members
    if (currentUser.is_admin) return true;
    
    // Check if current user is owner/admin of this group based on their role in groupMembers
    const currentUserMember = groupMembers.find(m => m.user_id === currentUser.user_id);
    return currentUserMember?.role === 'owner' || currentUserMember?.role === 'admin';
  };

  const handlePromoteToAdmin = async (member: GroupMember): Promise<void> => {
    if (window.confirm(`Promote ${member.username} to admin?`)) {
      try {
        await onPromoteToAdmin(selectedConversation, member.user_id);
      } catch (error) {
        console.error('Failed to promote member:', error);
      }
    }
  };

  const handleDemoteToMember = async (member: GroupMember): Promise<void> => {
    if (window.confirm(`Demote ${member.username} to regular member?`)) {
      try {
        await onDemoteToMember(selectedConversation, member.user_id);
      } catch (error) {
        console.error('Failed to demote member:', error);
      }
    }
  };

  const handleKickMember = async (member: GroupMember): Promise<void> => {
    if (window.confirm(`Kick ${member.username} from the group?`)) {
      try {
        await onKickMember(selectedConversation, member.user_id);
      } catch (error) {
        console.error('Failed to kick member:', error);
      }
    }
  };

  const handleBanMember = async (member: GroupMember): Promise<void> => {
    if (window.confirm(`Ban ${member.username} from the group? This action cannot be undone.`)) {
      try {
        await onBanMember(selectedConversation, member.user_id);
      } catch (error) {
        console.error('Failed to ban member:', error);
      }
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
                  className="p-3 rounded border border-gray-700 hover:border-gray-500 transition-colors"
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
                    <div className="flex items-center space-x-2">
                      <div className="text-gray-400 text-sm mr-2">
                        Joined {formatJoinDate(member.join_date)}
                      </div>
                      {canManageMember(member) && (
                        <div className="flex space-x-1">
                          {member.role === 'member' && (
                            <button
                              onClick={() => handlePromoteToAdmin(member)}
                              className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                              title="Promote to Admin"
                            >
                              <FontAwesomeIcon icon={faUserPlus} size="sm" />
                            </button>
                          )}
                          {member.role === 'admin' && (
                            <button
                              onClick={() => handleDemoteToMember(member)}
                              className="p-1 text-yellow-400 hover:text-yellow-300 transition-colors"
                              title="Demote to Member"
                            >
                              <FontAwesomeIcon icon={faUserMinus} size="sm" />
                            </button>
                          )}
                          <button
                            onClick={() => handleKickMember(member)}
                            className="p-1 text-orange-400 hover:text-orange-300 transition-colors"
                            title="Kick Member"
                          >
                            <FontAwesomeIcon icon={faUserTimes} size="sm" />
                          </button>
                          <button
                            onClick={() => handleBanMember(member)}
                            className="p-1 text-red-400 hover:text-red-300 transition-colors"
                            title="Ban Member"
                          >
                            <FontAwesomeIcon icon={faBan} size="sm" />
                          </button>
                        </div>
                      )}
                    </div>
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

export default MembersModal;