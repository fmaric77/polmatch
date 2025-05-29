import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck, faX, faUsers, faRefresh } from '@fortawesome/free-solid-svg-icons';

interface GroupInvitation {
  invitation_id: string;
  group_id: string;
  group_name: string;
  inviter_username: string;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-black border border-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <FontAwesomeIcon icon={faUsers} />
            <span>Group Invitations ({invitations.length})</span>
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              className="text-gray-400 hover:text-white transition-colors p-2"
              title="Refresh invitations"
            >
              <FontAwesomeIcon icon={faRefresh} />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-600/20 border border-red-600 rounded p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {invitations.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <FontAwesomeIcon icon={faUsers} className="text-4xl mb-4" />
              <p className="text-lg mb-2">No pending invitations</p>
              <p className="text-sm">You&apos;ll see group invitations here when you receive them</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div
                  key={invitation.invitation_id}
                  className="border border-gray-700 rounded-lg p-4 bg-gray-900/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <FontAwesomeIcon icon={faUsers} className="text-blue-400" />
                        <h3 className="text-white font-semibold">{invitation.group_name}</h3>
                      </div>
                      <p className="text-gray-300 text-sm mb-1">
                        Invited by <span className="font-medium text-white">{invitation.inviter_username}</span>
                      </p>
                      <p className="text-gray-400 text-xs">
                        {formatInviteDate(invitation.created_at)}
                      </p>
                    </div>

                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleResponse(invitation.invitation_id, 'accept')}
                        disabled={isResponding(invitation.invitation_id)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
                      >
                        <FontAwesomeIcon icon={faCheck} />
                        <span>{isResponding(invitation.invitation_id) ? 'Accepting...' : 'Accept'}</span>
                      </button>
                      <button
                        onClick={() => handleResponse(invitation.invitation_id, 'decline')}
                        disabled={isResponding(invitation.invitation_id)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
                      >
                        <FontAwesomeIcon icon={faX} />
                        <span>{isResponding(invitation.invitation_id) ? 'Declining...' : 'Decline'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-700 mt-4">
          <button
            onClick={onClose}
            className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 transition-colors"
            disabled={responding.size > 0}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InvitationsModal;