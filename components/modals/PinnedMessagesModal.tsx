import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faThumbtack } from '@fortawesome/free-solid-svg-icons';
import ProfileAvatar from '../ProfileAvatar';
import MessageContent from '../MessageContent';
import PollArtifact from '../PollArtifact';
import { useTheme } from '../ThemeProvider';

interface PinnedMessage {
  message_id: string;
  sender_id: string;
  content: string;
  timestamp: string;
  is_pinned: boolean;
  pinned_at: string;
  pinned_by: string;
  message_type?: 'text' | 'poll';
  poll_data?: {
    poll_id: string;
    question: string;
    options: Array<{
      option_id: string;
      text: string;
    }>;
    expires_at?: string;
  };
  attachments: string[];
  reply_to?: {
    message_id: string;
    content: string;
    sender_name: string;
  };
  sender_display_name: string;
  sender_profile_picture?: string;
  pinned_by_display_name: string | null;
}

interface PinnedMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  channelId?: string;
  currentUser: { user_id: string; username: string; is_admin?: boolean } | null;
  onVote?: (pollId: string, optionId: string) => void;
}

const PinnedMessagesModal: React.FC<PinnedMessagesModalProps> = ({
  isOpen,
  onClose,
  groupId,
  channelId,
  currentUser,
  onVote
}) => {
  const { theme } = useTheme();
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPinnedMessages = async () => {
    if (!groupId) return;

    setLoading(true);
    setError(null);

    try {
      const url = channelId 
        ? `/api/groups/${groupId}/pinned?channel_id=${channelId}`
        : `/api/groups/${groupId}/pinned`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setPinnedMessages(data.pinned_messages || []);
      } else {
        setError(data.error || 'Failed to fetch pinned messages');
      }
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
      setError('Failed to load pinned messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && groupId) {
      fetchPinnedMessages();
    }
  }, [isOpen, groupId, channelId]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 ${theme === 'dark' ? 'bg-black/70' : 'bg-black/50'} flex items-center justify-center z-50 p-4`}>
      <div className={`${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border-2 rounded-none shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b-2 ${theme === 'dark' ? 'border-white' : 'border-black'}`}>
          <div className="flex items-center space-x-3">
            <FontAwesomeIcon icon={faThumbtack} className={`${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`} />
            <h2 className={`text-xl font-mono uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              Pinned Messages
              {channelId && (
                <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} text-sm ml-2`}>
                  #{channelId}
                </span>
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'} transition-colors p-2`}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className={`${theme === 'dark' ? 'bg-black border-yellow-400' : 'bg-white border-yellow-600'} border-2 rounded-none p-4 shadow-2xl`}>
                <div className={`${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'} font-mono uppercase tracking-wider`}>
                  Loading pinned messages...
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32">
              <div className={`${theme === 'dark' ? 'bg-black border-red-400' : 'bg-white border-red-600'} border-2 rounded-none p-4 shadow-2xl`}>
                <div className={`${theme === 'dark' ? 'text-red-400' : 'text-red-600'} font-mono uppercase tracking-wider`}>
                  {error}
                </div>
              </div>
            </div>
          ) : pinnedMessages.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className={`text-center ${theme === 'dark' ? 'bg-black border-gray-600' : 'bg-white border-gray-400'} border-2 rounded-none p-6 shadow-2xl`}>
                <FontAwesomeIcon icon={faThumbtack} className={`${theme === 'dark' ? 'text-gray-600' : 'text-gray-500'} text-2xl mb-3`} />
                <p className={`mb-2 font-mono uppercase tracking-wide ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  No pinned messages
                </p>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'} font-mono`}>
                  Pin important messages to keep them easily accessible
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {pinnedMessages.map((message) => (
                <div
                  key={message.message_id}
                  className={`${theme === 'dark' ? 'bg-black border-yellow-400/50' : 'bg-white border-yellow-600/50'} border-2 rounded-none p-4 shadow-lg`}
                >
                  {/* Message Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`border-2 ${theme === 'dark' ? 'border-white' : 'border-black'} rounded-none p-1 shadow-lg`}>
                        <ProfileAvatar userId={message.sender_id} size={24} />
                      </div>
                      <div>
                        <span className={`text-sm font-mono uppercase tracking-wide ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                          {message.sender_display_name}
                        </span>
                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} font-mono`}>
                          {new Date(message.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className={`flex items-center space-x-2 text-xs ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'} font-mono`}>
                      <FontAwesomeIcon icon={faThumbtack} />
                      <span>PINNED</span>
                    </div>
                  </div>

                  {/* Reply indicator */}
                  {message.reply_to && (
                    <div className={`mb-3 p-2 ${theme === 'dark' ? 'bg-gray-800 border-blue-400' : 'bg-gray-200 border-blue-600'} border-l-4 rounded-r text-sm`}>
                      <div className={`${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} text-xs font-mono uppercase tracking-wider mb-1`}>
                        REPLYING TO {message.reply_to.sender_name}
                      </div>
                      <div className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} text-xs break-words`}>
                        {message.reply_to.content}
                      </div>
                    </div>
                  )}

                  {/* Message Content */}
                  <div className="mb-3">
                    {message.message_type === 'poll' && message.poll_data ? (
                      <PollArtifact
                        pollData={message.poll_data}
                        onVote={onVote || (() => {})}
                        pollResults={undefined}
                        currentUser={currentUser}
                        groupId={groupId}
                      />
                    ) : (
                      <div className="break-words text-white">
                        <MessageContent content={message.content} />
                      </div>
                    )}
                  </div>

                  {/* Pin Info */}
                  {message.pinned_by_display_name && (
                    <div className="text-xs text-gray-500 font-mono border-t border-gray-700 pt-2">
                      Pinned by {message.pinned_by_display_name} on{' '}
                      {new Date(message.pinned_at).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`border-t-2 ${theme === 'dark' ? 'border-white' : 'border-black'} p-4`}>
          <div className="flex items-center justify-between">
            <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} font-mono`}>
              {pinnedMessages.length} pinned message{pinnedMessages.length !== 1 ? 's' : ''}
            </div>
            <button
              onClick={onClose}
              className={`${theme === 'dark' ? 'bg-black text-white border-white hover:bg-white hover:text-black' : 'bg-white text-black border-black hover:bg-black hover:text-white'} border-2 px-4 py-2 rounded-none transition-all shadow-lg font-mono uppercase tracking-wider`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PinnedMessagesModal;
