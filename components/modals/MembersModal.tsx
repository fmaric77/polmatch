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
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 font-mono">
      <div className="bg-black border-2 border-white rounded-none p-6 w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-yellow-400 font-mono uppercase tracking-widest text-xs mb-2">PERSONNEL ROSTER</div>
            <h2 className="text-xl font-mono uppercase tracking-wider text-white flex items-center">
              <FontAwesomeIcon icon={faUsers} className="mr-3" />
              ACTIVE AGENTS ({groupMembers.length})
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
          {groupMembers.length === 0 ? (
            <div className="text-center py-8">
              <div className="bg-black border-2 border-gray-400 rounded-none p-4 shadow-lg">
                <div className="text-gray-400 font-mono uppercase tracking-wide">NO AGENTS ASSIGNED</div>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto space-y-3">
              {sortedMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="p-3 bg-black border-2 border-gray-400 rounded-none hover:border-white transition-all shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="border border-white rounded-none p-1">
                        {getRoleIcon(member.role)}
                      </div>
                      <div>
                        <div className="text-white font-mono uppercase tracking-wide">
                          AGENT-{member.username}
                        </div>
                        <div className={`text-sm font-mono uppercase tracking-widest ${getRoleColor(member.role)}`}>
                          {member.role} | CLEARANCE: {member.role === 'owner' ? 'ALPHA' : member.role === 'admin' ? 'BETA' : 'GAMMA'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-gray-400 text-xs mr-2 font-mono uppercase tracking-widest">
                        RECRUITED: {formatJoinDate(member.join_date)}
                      </div>
                      {canManageMember(member) && (
                        <div className="flex space-x-1">
                          {member.role === 'member' && (
                            <button
                              onClick={() => handlePromoteToAdmin(member)}
                              className="p-1 bg-black text-blue-400 border border-blue-400 rounded-none hover:bg-blue-400 hover:text-black transition-all shadow-sm font-mono"
                              title="PROMOTE TO ADMIN"
                            >
                              <FontAwesomeIcon icon={faUserPlus} size="sm" />
                            </button>
                          )}
                          {member.role === 'admin' && (
                            <button
                              onClick={() => handleDemoteToMember(member)}
                              className="p-1 bg-black text-yellow-400 border border-yellow-400 rounded-none hover:bg-yellow-400 hover:text-black transition-all shadow-sm font-mono"
                              title="DEMOTE TO MEMBER"
                            >
                              <FontAwesomeIcon icon={faUserMinus} size="sm" />
                            </button>
                          )}
                          <button
                            onClick={() => handleKickMember(member)}
                            className="p-1 bg-black text-orange-400 border border-orange-400 rounded-none hover:bg-orange-400 hover:text-black transition-all shadow-sm font-mono"
                            title="REMOVE AGENT"
                          >
                            <FontAwesomeIcon icon={faUserTimes} size="sm" />
                          </button>
                          <button
                            onClick={() => handleBanMember(member)}
                            className="p-1 bg-black text-red-400 border border-red-400 rounded-none hover:bg-red-400 hover:text-black transition-all shadow-sm font-mono"
                            title="TERMINATE AGENT"
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

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="bg-black text-white border-2 border-white py-3 px-6 rounded-none hover:bg-white hover:text-black transition-all shadow-lg font-mono uppercase tracking-wider"
          >
            CLOSE ROSTER
          </button>
        </div>
      </div>
    </div>
  );
};

export default MembersModal;