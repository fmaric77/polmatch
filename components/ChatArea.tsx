import React, { useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPaperPlane,
  faHashtag,
  faUsers,
  faUserPlus,
  faCheck,
  faCheckDouble,
  faBars
} from '@fortawesome/free-solid-svg-icons';
import ProfileAvatar from './ProfileAvatar';
import MessageContent from './MessageContent';

interface PrivateMessage {
  _id?: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachments: string[];
}

interface GroupMessage {
  message_id: string;
  group_id: string;
  channel_id?: string;
  sender_id: string;
  content: string;
  timestamp: string;
  attachments: string[];
  sender_username: string;
  current_user_read: boolean;
  total_members: number;
  read_count: number;
  read_by_others: boolean;
}

interface Channel {
  channel_id: string;
  group_id: string;
  name: string;
  description: string;
  created_at: string;
  created_by: string;
  is_default: boolean;
  position: number;
}

interface Conversation {
  id: string;
  name: string;
  type: 'direct' | 'group';
  is_private?: boolean;
  last_message?: string;
  last_activity?: string;
  unread_count?: number;
  members_count?: number;
  user_id?: string;
}

interface ChatAreaProps {
  selectedConversation: string;
  selectedConversationType: 'direct' | 'group';
  selectedChannel: string;
  setSelectedChannel: (channelId: string) => void;
  selectedConversationData: Conversation | undefined;
  groupChannels: Channel[];
  messages: (PrivateMessage | GroupMessage)[];
  newMessage: string;
  setNewMessage: (message: string) => void;
  onSendMessage: () => void;
  onMessageContextMenu: (e: React.MouseEvent, message: PrivateMessage | GroupMessage) => void;
  currentUser: { user_id: string; username: string; is_admin?: boolean } | null;
  channelLoading: boolean;
  contextSwitchLoading: boolean;
  isMobile: boolean;
  isConversationsSidebarHidden: boolean;
  setIsConversationsSidebarHidden: (hidden: boolean) => void;
  onMembersClick: () => void;
  onInviteClick: () => void;
  onCreateChannelClick: () => void;
  onChannelContextMenu: (e: React.MouseEvent, channel: Channel) => void;
  canManageMembers: boolean;
}

const ChatArea: React.FC<ChatAreaProps> = ({
  selectedConversation,
  selectedConversationType,
  selectedChannel,
  setSelectedChannel,
  selectedConversationData,
  groupChannels,
  messages,
  newMessage,
  setNewMessage,
  onSendMessage,
  onMessageContextMenu,
  currentUser,
  channelLoading,
  contextSwitchLoading,
  isMobile,
  isConversationsSidebarHidden,
  setIsConversationsSidebarHidden,
  onMembersClick,
  onInviteClick,
  onCreateChannelClick,
  onChannelContextMenu,
  canManageMembers
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  if (!selectedConversation) {
    return (
      <div className="flex-1 flex flex-col bg-black text-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl mb-4">Welcome to PolMatch Messages</h2>
            <p className="text-gray-400">Select a conversation to start messaging</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-black text-white relative">
      {/* Loading Overlay for Context Switches */}
      {contextSwitchLoading && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="text-white text-xl">Loading...</div>
        </div>
      )}

      {/* Chat Header */}
      <div className="p-4 border-b border-white flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Mobile Toggle Button */}
          {isMobile && isConversationsSidebarHidden && (
            <button
              onClick={() => setIsConversationsSidebarHidden(false)}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              title="Show Conversations"
            >
              <FontAwesomeIcon icon={faBars} />
            </button>
          )}

          {/* Conversation Info */}
          {selectedConversationData?.type === 'direct' && selectedConversationData.user_id ? (
            <ProfileAvatar userId={selectedConversationData.user_id} size={32} />
          ) : (
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
              <FontAwesomeIcon 
                icon={selectedConversationType === 'group' ? faHashtag : faUsers} 
                className="text-white text-sm"
              />
            </div>
          )}
          
          <div>
            <h2 className="text-lg font-bold">
              {selectedConversationData?.name || 'Unknown'}
              {selectedConversationType === 'group' && selectedChannel && groupChannels.length > 0 && (
                <>
                  <span className="text-gray-400 mx-2">/</span>
                  <span className="text-blue-400">
                    #{groupChannels.find(ch => ch.channel_id === selectedChannel)?.name || 'general'}
                  </span>
                </>
              )}
            </h2>
            {selectedConversationData?.members_count && (
              <p className="text-sm text-gray-400">
                {selectedConversationData.members_count} members
              </p>
            )}
          </div>
        </div>

        {/* Group Actions */}
        {selectedConversationType === 'group' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={onMembersClick}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              title="View Members"
            >
              <FontAwesomeIcon icon={faUsers} />
            </button>
            {canManageMembers && (
              <button
                onClick={onInviteClick}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                title="Invite Users"
              >
                <FontAwesomeIcon icon={faUserPlus} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Group Channels Navigation */}
      {selectedConversationType === 'group' && groupChannels.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-700">
          <div className="flex items-center space-x-4 overflow-x-auto">
            {groupChannels.map((channel) => (
              <button
                key={channel.channel_id}
                onClick={() => setSelectedChannel(channel.channel_id)}
                onContextMenu={e => onChannelContextMenu(e, channel)}
                className={`flex items-center space-x-1 px-3 py-1 rounded whitespace-nowrap transition-colors ${
                  selectedChannel === channel.channel_id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <FontAwesomeIcon icon={faHashtag} className="text-xs" />
                <span className="text-sm">{channel.name}</span>
              </button>
            ))}
            {canManageMembers && (
              <button
                onClick={onCreateChannelClick}
                className="flex items-center space-x-1 px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white transition-colors whitespace-nowrap"
                title="Create Channel"
              >
                <FontAwesomeIcon icon={faHashtag} className="text-xs" />
                <span className="text-sm">+</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {channelLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <p className="mb-2">No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const isCurrentUser = message.sender_id === currentUser?.user_id;
            const showAvatar = !isCurrentUser && (
              index === 0 || 
              messages[index - 1].sender_id !== message.sender_id ||
              new Date(message.timestamp).getTime() - new Date(messages[index - 1].timestamp).getTime() > 300000
            );

            return (
              <div
                key={(message as PrivateMessage)._id || (message as GroupMessage).message_id}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} ${
                  showAvatar ? 'mt-4' : 'mt-1'
                }`}
                onContextMenu={e => onMessageContextMenu(e, message)}
              >
                {!isCurrentUser && showAvatar && (
                  <div className="mr-2">
                    <ProfileAvatar userId={message.sender_id} size={32} />
                  </div>
                )}
                
                <div className={`max-w-md ${!isCurrentUser && !showAvatar ? 'ml-10' : ''}`}>
                  {!isCurrentUser && showAvatar && (
                    <div className="mb-1">
                      <span className="text-sm font-medium text-blue-400">
                        {(message as GroupMessage).sender_username || message.sender_id}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                  
                  <div
                    className={`p-3 rounded-lg ${
                      isCurrentUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-white'
                    }`}
                  >
                    <MessageContent content={message.content} />
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs opacity-70">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                      
                      {isCurrentUser && selectedConversationType === 'direct' && (
                        <FontAwesomeIcon
                          icon={(message as PrivateMessage).read ? faCheckDouble : faCheck}
                          className={`text-xs ${
                            (message as PrivateMessage).read ? 'text-blue-400' : 'text-gray-400'
                          }`}
                        />
                      )}
                      
                      {isCurrentUser && selectedConversationType === 'group' && (
                        <div className="flex items-center space-x-1 text-xs opacity-70">
                          <FontAwesomeIcon icon={faCheckDouble} />
                          <span>
                            {(message as GroupMessage).read_count || 0}/{(message as GroupMessage).total_members || 1}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-white">
        <div className="flex space-x-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Message ${selectedConversationData?.name || ''}...`}
            className="flex-1 bg-black text-white border border-white rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-white"
            rows={1}
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
          <button
            onClick={onSendMessage}
            disabled={!newMessage.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <FontAwesomeIcon icon={faPaperPlane} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;