import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck, faX, faUsers, faRefresh } from '@fortawesome/free-solid-svg-icons';
import { getAnonymousDisplayName } from '../../lib/anonymization';
import { useTheme } from '../ThemeProvider';

interface GroupInvitation {
  invitation_id: string;
  group_id: string;
  group_name: string;
  inviter_username: string;
  inviter_display_name?: string;
  inviter_id?: string;
  created_at: string;
}

interface InvitationsModalProps {
  invitations: GroupInvitation[];
  onClose: () => void;
  onRespond: (invitationId: string, response: 'accept' | 'decline') => Promise<boolean>;
  onRefresh: () => void;
  onAcceptGroup?: (groupId: string) => void;
}

const InvitationsModal: React.FC<InvitationsModalProps> = ({
  invitations,
  onClose,
  onRespond,
  onRefresh
  , onAcceptGroup
}) => {
  const { theme } = useTheme();
  // Fetch invitations when modal opens
  useEffect(() => {
    onRefresh();
  }, []);
  const [responding, setResponding] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const handleResponse = async (invitationId: string, response: 'accept' | 'decline'): Promise<void> => {
    setResponding(prev => new Set(prev).add(invitationId));
    setError('');

    try {
      const success = await onRespond(invitationId, response);
      if (success) {
        // Refresh the invitations list after successful response
        onRefresh();
        // If accepted, notify parent to update group list
        if (response === 'accept' && onAcceptGroup) {
          const accepted = invitations.find(inv => inv.invitation_id === invitationId);
          if (accepted) {
            onAcceptGroup(accepted.group_id);
          }
        }
      } else {
        setError(`Failed to ${response} invitation. Please try again.`);
      }
    } catch (err) {
      console.error('Error responding to invitation:', err);
      setError(`Failed to ${response} invitation. Please try again.`);
    } finally {
      setResponding(prev => {
        const updated = new Set(prev);
        updated.delete(invitationId);
        return updated;
      });
    }
  };

  const formatInviteDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    }
  };

  const isResponding = (invitationId: string): boolean => responding.has(invitationId);

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 font-mono">
      <div className={`${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border-2 rounded-none p-6 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col shadow-2xl`}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="text-yellow-400 font-mono uppercase tracking-widest text-xs mb-2">GROUP INVITATIONS</div>
            <h2 className={`text-xl font-mono uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-black'} flex items-center space-x-3`}>
              <FontAwesomeIcon icon={faUsers} />
              <span>PENDING INVITES ({invitations.length})</span>
            </h2>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onRefresh}
              className={`p-2 ${theme === 'dark' ? 'bg-black text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-black' : 'bg-white text-blue-500 border-blue-500 hover:bg-blue-500 hover:text-white'} border rounded-none transition-all shadow-lg font-mono`}
              title="REFRESH INVITES"
            >
              <FontAwesomeIcon icon={faRefresh} />
            </button>
            <button
              onClick={onClose}
              className={`p-2 ${theme === 'dark' ? 'bg-black text-red-400 border-red-400 hover:bg-red-400 hover:text-black' : 'bg-white text-red-500 border-red-500 hover:bg-red-500 hover:text-white'} border rounded-none transition-all shadow-lg font-mono`}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>

        {error && (
          <div className={`${theme === 'dark' ? 'bg-red-600/20 border-red-400' : 'bg-red-100 border-red-500'} border-2 rounded-none p-3 mb-4`}>
            <p className={`${theme === 'dark' ? 'text-red-400' : 'text-red-600'} text-sm font-mono uppercase tracking-wide`}>{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {invitations.length === 0 ? (
            <div className="text-center py-8">
              <div className={`${theme === 'dark' ? 'bg-black border-gray-400' : 'bg-gray-50 border-gray-300'} border-2 rounded-none p-6 shadow-lg`}>
                <FontAwesomeIcon icon={faUsers} className={`text-4xl mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
                <p className={`text-lg mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} font-mono uppercase tracking-wide`}>NO PENDING INVITES</p>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'} font-mono uppercase tracking-widest`}>GROUP INVITATIONS WILL APPEAR HERE</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {invitations.map((invitation) => (
                <div
                  key={invitation.invitation_id}
                  className={`border-2 ${theme === 'dark' ? 'border-white bg-black' : 'border-black bg-white'} rounded-none p-4 shadow-lg`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`p-2 ${theme === 'dark' ? 'bg-blue-600/20 border-blue-400' : 'bg-blue-100 border-blue-500'} border rounded-none`}>
                          <FontAwesomeIcon icon={faUsers} className={theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} />
                        </div>
                        <div>
                          <h3 className={`${theme === 'dark' ? 'text-white' : 'text-black'} font-mono uppercase tracking-wide text-lg`}>{invitation.group_name}</h3>
                          <div className="text-yellow-400 text-xs font-mono uppercase tracking-widest">GROUP INVITATION</div>
                        </div>
                      </div>
                      <div className={`${theme === 'dark' ? 'bg-black border-gray-500' : 'bg-gray-100 border-gray-400'} border rounded-none p-3 shadow-inner`}>
                        <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} text-sm font-mono uppercase tracking-wide mb-1`}>
                          INVITED BY: <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                            {getAnonymousDisplayName(invitation.inviter_display_name, invitation.inviter_username, invitation.inviter_id || '')}
                          </span>
                        </p>
                        <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-xs font-mono uppercase tracking-widest`}>
                          SENT: {formatInviteDate(invitation.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex space-x-3 ml-4">
                      <button
                        onClick={() => handleResponse(invitation.invitation_id, 'accept')}
                        disabled={isResponding(invitation.invitation_id)}
                        className={`${theme === 'dark' ? 'bg-black text-green-400 border-green-400 hover:bg-green-400 hover:text-black' : 'bg-white text-green-600 border-green-600 hover:bg-green-600 hover:text-white'} border-2 px-4 py-2 rounded-none disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed transition-all shadow-lg font-mono uppercase tracking-wide flex items-center space-x-2`}
                      >
                        <FontAwesomeIcon icon={faCheck} />
                        <span>{isResponding(invitation.invitation_id) ? 'ACCEPTING...' : 'ACCEPT'}</span>
                      </button>
                      <button
                        onClick={() => handleResponse(invitation.invitation_id, 'decline')}
                        disabled={isResponding(invitation.invitation_id)}
                        className={`${theme === 'dark' ? 'bg-black text-red-400 border-red-400 hover:bg-red-400 hover:text-black' : 'bg-white text-red-500 border-red-500 hover:bg-red-500 hover:text-white'} border-2 px-4 py-2 rounded-none disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed transition-all shadow-lg font-mono uppercase tracking-wide flex items-center space-x-2`}
                      >
                        <FontAwesomeIcon icon={faX} />
                        <span>{isResponding(invitation.invitation_id) ? 'DECLINING...' : 'DECLINE'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`flex justify-end pt-6 border-t-2 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'} mt-6`}>
          <button
            onClick={onClose}
            className={`${theme === 'dark' ? 'bg-black text-white border-white hover:bg-white hover:text-black' : 'bg-white text-black border-black hover:bg-black hover:text-white'} border-2 px-6 py-3 rounded-none transition-all shadow-lg font-mono uppercase tracking-wider`}
            disabled={responding.size > 0}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvitationsModal;