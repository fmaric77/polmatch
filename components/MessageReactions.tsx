import React, { useState, useEffect } from 'react';
import { useCSRFToken } from './hooks/useCSRFToken';

interface Reaction {
  count: number;
  users: Array<{ user_id: string; username: string }>;
  user_reacted: boolean;
}

interface MessageReactionsProps {
  messageId: string;
  messageType: 'direct' | 'group';
  groupId?: string;
  channelId?: string;
  onReactionChange?: () => void; // Callback to refresh message data
}

// Available reaction types
const REACTION_TYPES = {
  '👍': { label: 'Like' },
  '❤️': { label: 'Love' },
  '😂': { label: 'Funny' },
  '😮': { label: 'Wow' },
  '😢': { label: 'Sad' },
  '😡': { label: 'Angry' }
};

const MessageReactions: React.FC<MessageReactionsProps> = ({
  messageId,
  messageType,
  groupId,
  channelId,
  onReactionChange
}) => {
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const { protectedFetch } = useCSRFToken();

  // Fetch reactions for this message
  const fetchReactions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        message_id: messageId,
        message_type: messageType
      });

      const response = await protectedFetch(`/api/messages/reactions?${params}`);
      const data = await response.json();

      if (data.success) {
        setReactions(data.reactions || {});
      } else {
        console.error('Failed to fetch reactions:', data.error);
      }
    } catch (error) {
      console.error('Error fetching reactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add or remove a reaction
  const handleReaction = async (reactionType: string) => {
    try {
      const requestBody = {
        message_id: messageId,
        message_type: messageType,
        reaction_type: reactionType,
        ...(groupId && { group_id: groupId }),
        ...(channelId && { channel_id: channelId })
      };

      const response = await protectedFetch('/api/messages/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.success) {
        // Refresh reactions
        await fetchReactions();
        // Notify parent component
        if (onReactionChange) {
          onReactionChange();
        }
      } else {
        console.error('Failed to handle reaction:', data.error);
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
    }
  };

  // Load reactions when component mounts or messageId changes
  useEffect(() => {
    if (messageId) {
      fetchReactions();
    }
  }, [messageId, messageType]);

  // Get total reaction count
  const totalReactions = Object.values(reactions).reduce((sum, reaction) => sum + reaction.count, 0);

  // If no reactions, don't render anything
  if (totalReactions === 0 && !showEmojiPicker) {
    return null;
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 relative">
      {/* Existing Reactions */}
      {Object.entries(reactions).map(([reactionType, reaction]) => (
        <button
          key={reactionType}
          onClick={() => handleReaction(reactionType)}
          className={`
            inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs border transition-all
            ${reaction.user_reacted 
              ? 'bg-blue-600 border-blue-400 text-white shadow-blue-400/30' 
              : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400 hover:text-white'
            }
          `}
          title={`${reaction.users.map(u => u.username).join(', ')} reacted with ${reactionType}`}
          disabled={loading}
        >
          <span className="text-sm">{reactionType}</span>
          <span className="font-mono text-xs">{reaction.count}</span>
        </button>
      ))}

      {/* Add Reaction Button */}
      <div className="relative">
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="
            inline-flex items-center justify-center w-6 h-6 rounded-full text-xs border
            bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white
            transition-all
          "
          title="Add reaction"
        >
          <span className="text-sm">+</span>
        </button>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <>
            {/* Backdrop to close picker */}
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowEmojiPicker(false)}
            />
            
            {/* Picker Content */}
            <div className="absolute bottom-full left-0 mb-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 p-2">
              <div className="grid grid-cols-3 gap-1">
                {Object.entries(REACTION_TYPES).map(([emoji, config]) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      handleReaction(emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="
                      flex items-center justify-center w-8 h-8 rounded hover:bg-gray-700 
                      transition-colors text-lg
                    "
                    title={config.label}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MessageReactions; 