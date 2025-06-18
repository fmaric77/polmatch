import React, { useRef, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPaperPlane,
  faHashtag,
  faUsers,
  faUserPlus,
  faCheck,
  faCheckDouble,
  faBars,
  faBan,
  faEnvelope,
  faChevronDown
} from '@fortawesome/free-solid-svg-icons';
import ProfileAvatar from './ProfileAvatar';
import MessageContent from './MessageContent';
import TypingIndicator from './TypingIndicator';
import { TypingData } from './hooks/useTypingIndicator';
import { profilePictureCache } from '../lib/profilePictureCache';
import { getAnonymousDisplayName } from '../lib/anonymization';

interface PrivateMessage {
  _id?: string;
  conversation_id?: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachments: string[];
  profile_type?: 'basic' | 'love' | 'business';
  sender_profile_data?: {
    display_name: string;
    profile_picture_url: string;
  };
  reply_to?: {
    message_id: string;
    content: string;
    sender_name: string;
  };
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
  sender_display_name?: string;
  current_user_read: boolean;
  total_members: number;
  read_count: number;
  read_by_others: boolean;
  reply_to?: {
    message_id: string;
    content: string;
    sender_name: string;
  };
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
  creator_id?: string;
  user_role?: string;
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
  replyTo?: { id: string; content: string; sender_name: string } | null;
  setReplyTo?: (reply: { id: string; content: string; sender_name: string } | null) => void;
  currentUser: { user_id: string; username: string; is_admin?: boolean } | null;
  channelLoading: boolean;
  contextSwitchLoading: boolean;
  isMobile: boolean;
  isConversationsSidebarHidden: boolean;
  setIsConversationsSidebarHidden: (hidden: boolean) => void;
  setIsSidebarVisible: (visible: boolean) => void;
  onMembersClick: () => void;
  onInviteClick: () => void;
  onBannedUsersClick: () => void;
  onCreateChannelClick: () => void;
  onChannelContextMenu: (e: React.MouseEvent, channel: Channel) => void;
  canManageMembers: boolean;
  // Typing indicator props
  typingUsers: TypingData[];
  onTyping: () => void;
  sessionToken: string | null;
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
  replyTo,
  setReplyTo,
  currentUser,
  channelLoading,
  contextSwitchLoading,
  isMobile,
  isConversationsSidebarHidden,
  setIsConversationsSidebarHidden,
  setIsSidebarVisible,
  onMembersClick,
  onInviteClick,
  onBannedUsersClick,
  onCreateChannelClick,
  onChannelContextMenu,
  canManageMembers,
  typingUsers,
  onTyping,

}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Prefetch profile pictures for all message senders to reduce API spam
  useEffect(() => {
    const senderIds = messages
      .map(msg => msg.sender_id)
      .filter((senderId, index, array) => array.indexOf(senderId) === index); // Remove duplicates
    
    if (senderIds.length > 0) {
      // Batch prefetch all profile pictures for message senders efficiently
      profilePictureCache.prefetchMultiple(senderIds)
        .catch(err => console.warn('Error prefetching message sender profile pictures:', err));
    }
  }, [messages]);

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
      <div className="flex-1 flex flex-col bg-black text-white font-mono">
        {/* FBI Navigation Header */}
        <div className="p-4 border-b-2 border-white rounded-none flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-4">
            {/* Mobile Toggle Buttons */}
            {isMobile && (
              <div className="flex items-center space-x-3">
                {/* Main Navigation Toggle */}
                <button
                  onClick={() => setIsSidebarVisible(true)}
                  className="p-2 bg-black text-green-400 border border-green-400 rounded-none hover:bg-green-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wider"
                  title="SHOW NAVIGATION"
                >
                  <FontAwesomeIcon icon={faBars} />
                </button>
                
                {/* Conversations Toggle (only show if conversations are hidden) */}
                {isConversationsSidebarHidden && (
                  <button
                    onClick={() => setIsConversationsSidebarHidden(false)}
                    className="p-2 bg-black text-blue-400 border border-blue-400 rounded-none hover:bg-blue-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wider"
                    title="SHOW CONVERSATIONS"
                  >
                    <FontAwesomeIcon icon={faEnvelope} />
                  </button>
                )}
              </div>
            )}
            
            {/* Desktop Conversations Toggle - Always show if conversations are hidden */}
            {!isMobile && isConversationsSidebarHidden && (
              <button
                onClick={() => setIsConversationsSidebarHidden(false)}
                className="p-2 bg-black text-blue-400 border border-blue-400 rounded-none hover:bg-blue-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wider"
                title="SHOW CONVERSATIONS"
              >
                <FontAwesomeIcon icon={faEnvelope} />
              </button>
            )}
            
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-mono uppercase tracking-wider">Messages</h2>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center bg-black border-2 border-white rounded-none p-8 shadow-2xl">
            <h2 className="text-2xl mb-4 font-mono uppercase tracking-wider">POLMATCH</h2>
            <div className="w-16 h-px bg-white mx-auto mb-4"></div>
            <p className="text-gray-300 font-mono text-sm">Select a conversation to start messaging</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-black text-white relative font-mono">
      {/* Loading Overlay for Context Switches */}
      {contextSwitchLoading && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 border-2 border-white rounded-none">
          <div className="bg-black border-2 border-yellow-400 rounded-none p-4 shadow-2xl">
            <div className="text-yellow-400 text-xl font-mono uppercase tracking-wider">Loading...</div>
          </div>
        </div>
      )}

      {/* FBI Chat Header */}
      <div className="p-4 border-b-2 border-white rounded-none flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-4">
          {/* Mobile Toggle Buttons */}
          {isMobile && (
            <div className="flex items-center space-x-3">
              {/* Main Navigation Toggle */}
              <button
                onClick={() => setIsSidebarVisible(true)}
                className="p-2 bg-black text-green-400 border border-green-400 rounded-none hover:bg-green-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wider"
                title="SHOW NAVIGATION"
              >
                <FontAwesomeIcon icon={faBars} />
              </button>
              
              {/* Conversations Toggle (only show if conversations are hidden) */}
              {isConversationsSidebarHidden && (
                <button
                  onClick={() => setIsConversationsSidebarHidden(false)}
                  className="p-2 bg-black text-blue-400 border border-blue-400 rounded-none hover:bg-blue-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wider"
                  title="SHOW CONVERSATIONS"
                >
                  <FontAwesomeIcon icon={faEnvelope} />
                </button>
              )}
            </div>
          )}

          {/* Desktop Conversations Toggle - Always show if conversations are hidden */}
          {!isMobile && isConversationsSidebarHidden && (
            <button
              onClick={() => setIsConversationsSidebarHidden(false)}
              className="p-2 bg-black text-blue-400 border border-blue-400 rounded-none hover:bg-blue-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wider"
              title="SHOW CONVERSATIONS"
            >
              <FontAwesomeIcon icon={faEnvelope} />
            </button>
          )}

          {/* Conversation Info */}
          {selectedConversationData?.type === 'direct' && selectedConversationData.user_id ? (
            <div className="border-2 border-white rounded-none p-1 shadow-lg">
              <ProfileAvatar userId={selectedConversationData.user_id} size={32} />
            </div>
          ) : (
            <div className="w-8 h-8 bg-black border-2 border-white rounded-none flex items-center justify-center shadow-lg">
              <FontAwesomeIcon 
                icon={selectedConversationType === 'group' ? faHashtag : faUsers} 
                className="text-white text-sm"
              />
            </div>
          )}
          
          <div>
            <h2 className="text-lg font-mono uppercase tracking-wider">
              {selectedConversationData?.name || 'Unknown Contact'}
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
              <p className="text-sm text-gray-400 font-mono">
                {selectedConversationData.members_count} members
              </p>
            )}
          </div>
        </div>

        {/* Group Actions */}
        {selectedConversationType === 'group' && (
          <div className="flex items-center space-x-3">
            <button
              onClick={onMembersClick}
              className="p-2 bg-black text-blue-400 border border-blue-400 rounded-none hover:bg-blue-400 hover:text-black transition-all shadow-lg font-mono"
              title="View Members"
            >
              <FontAwesomeIcon icon={faUsers} />
            </button>
            {canManageMembers && (
              <>
                <button
                  onClick={onInviteClick}
                  className="p-2 bg-black text-green-400 border border-green-400 rounded-none hover:bg-green-400 hover:text-black transition-all shadow-lg font-mono"
                  title="Invite User"
                >
                  <FontAwesomeIcon icon={faUserPlus} />
                </button>
                <button
                  onClick={onBannedUsersClick}
                  className="p-2 bg-black text-red-400 border border-red-400 rounded-none hover:bg-red-400 hover:text-black transition-all shadow-lg font-mono"
                  title="Banned Users"
                >
                  <FontAwesomeIcon icon={faBan} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Group Channels Navigation */}
      {selectedConversationType === 'group' && groupChannels.length > 0 && (
        <div className="px-4 py-3 border-b-2 border-gray-700 bg-black shadow-inner">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-yellow-400 font-mono uppercase tracking-widest text-xs">Channels</div>
            {isMobile && groupChannels.length > 3 && (
              <div className="text-xs text-gray-400 font-mono">
                {groupChannels.findIndex(ch => ch.channel_id === selectedChannel) + 1}/{groupChannels.length}
              </div>
            )}
          </div>
          
          {/* Mobile: Dropdown only */}
          {isMobile ? (
            <div className="relative">
              <button
                onClick={() => setShowChannelDropdown(!showChannelDropdown)}
                className="w-full flex items-center justify-between bg-blue-600 border-2 border-blue-400 px-3 py-2 rounded-none transition-all"
              >
                <div className="flex items-center space-x-2">
                  <FontAwesomeIcon icon={faHashtag} className="text-xs text-white" />
                  <span className="text-sm text-white font-mono uppercase tracking-wide">
                    {groupChannels.find(ch => ch.channel_id === selectedChannel)?.name || 'general'}
                  </span>
                </div>
                <FontAwesomeIcon 
                  icon={faChevronDown} 
                  className={`text-xs text-white transition-transform ${showChannelDropdown ? 'rotate-180' : ''}`}
                />
              </button>
              
              {/* Dropdown Menu */}
              {showChannelDropdown && (
                <>
                  {/* Backdrop to close dropdown */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowChannelDropdown(false)}
                  />
                  
                  {/* Dropdown Content */}
                  <div className="absolute top-full left-0 right-0 mt-1 bg-black border-2 border-white rounded-none shadow-2xl z-50 max-h-64 overflow-y-auto">
                    {groupChannels.map((channel, index) => (
                      <button
                        key={channel.channel_id}
                        onClick={() => {
                          setSelectedChannel(channel.channel_id);
                          setShowChannelDropdown(false);
                        }}
                        onContextMenu={e => {
                          e.preventDefault();
                          onChannelContextMenu(e, channel);
                          setShowChannelDropdown(false);
                        }}
                        className={`w-full flex items-center space-x-2 px-3 py-2 border-b border-gray-600 transition-colors font-mono text-sm ${
                          selectedChannel === channel.channel_id
                            ? 'bg-blue-600 text-white'
                            : 'bg-black text-gray-300 hover:bg-gray-800 hover:text-white'
                        } ${index === groupChannels.length - 1 && !canManageMembers ? 'border-b-0' : ''}`}
                      >
                        <FontAwesomeIcon icon={faHashtag} className="text-xs" />
                        <span className="uppercase tracking-wide">{channel.name}</span>
                        {channel.is_default && (
                          <span className="ml-auto text-xs text-yellow-400">DEFAULT</span>
                        )}
                      </button>
                    ))}
                    
                    {/* Create Channel Button in Dropdown */}
                    {canManageMembers && (
                      <button
                        onClick={() => {
                          onCreateChannelClick();
                          setShowChannelDropdown(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white transition-colors font-mono text-sm border-b-0"
                      >
                        <FontAwesomeIcon icon={faHashtag} className="text-xs" />
                        <span className="uppercase tracking-wide">CREATE NEW CHANNEL</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Desktop and Mobile with few channels: Horizontal scroll */
            <div className="flex items-center space-x-3 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-black">
              {groupChannels.map((channel) => (
                <button
                  key={channel.channel_id}
                  onClick={() => setSelectedChannel(channel.channel_id)}
                  onContextMenu={e => onChannelContextMenu(e, channel)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-none border-2 whitespace-nowrap transition-all shadow-lg font-mono uppercase tracking-wide ${
                    selectedChannel === channel.channel_id
                      ? 'bg-blue-600 border-blue-400 text-white shadow-blue-400/50'
                      : 'bg-black border-gray-400 text-gray-300 hover:border-white hover:text-white'
                  }`}
                >
                  <FontAwesomeIcon icon={faHashtag} className="text-xs" />
                  <span className="text-sm">{channel.name}</span>
                </button>
              ))}
              {canManageMembers && (
                <button
                  onClick={onCreateChannelClick}
                  className="flex items-center space-x-2 px-3 py-2 rounded-none border-2 bg-black border-green-400 text-green-400 hover:bg-green-400 hover:text-black transition-all shadow-lg font-mono uppercase tracking-wide whitespace-nowrap"
                  title="CREATE CHANNEL"
                >
                  <FontAwesomeIcon icon={faHashtag} className="text-xs" />
                  <span className="text-sm">NEW</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* FBI Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black">
        {channelLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="bg-black border-2 border-yellow-400 rounded-none p-4 shadow-2xl">
              <div className="text-yellow-400 font-mono uppercase tracking-wider">Loading messages...</div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center bg-black border-2 border-white rounded-none p-6 shadow-2xl">
              <p className="mb-2 font-mono uppercase tracking-wide">No messages yet</p>
              <div className="w-12 h-px bg-white mx-auto mb-3"></div>
              <p className="text-sm text-gray-400 font-mono">Start the conversation</p>
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
                  <div className="mr-3">
                    <div className="border-2 border-white rounded-none p-1 shadow-lg">
                      <ProfileAvatar userId={message.sender_id} size={32} />
                    </div>
                  </div>
                )}
                
                <div className={`max-w-md ${!isCurrentUser && !showAvatar ? 'ml-12' : ''}`}>
                  {!isCurrentUser && showAvatar && (
                    <div className="mb-2 bg-black border border-gray-500 rounded-none p-2 shadow-lg">
                      <div className="flex items-center space-x-2">
                        {(() => {
                          let displayName = null;
                          if (selectedConversationType === 'direct') {
                            // For direct messages, use the conversation name (which is the other user's display name)
                            displayName = selectedConversationData?.name && selectedConversationData.name !== 'Unknown Contact' 
                              ? selectedConversationData.name 
                              : null;
                          } else {
                            // For group messages, use proper fallback hierarchy
                            const groupMessage = message as GroupMessage;
                            displayName = getAnonymousDisplayName(
                              groupMessage.sender_display_name, 
                              groupMessage.sender_username, 
                              groupMessage.sender_id
                            );
                          }
                          
                          return displayName ? (
                            <span className="text-sm font-mono uppercase tracking-wide text-blue-400">
                              {displayName}
                            </span>
                          ) : (
                            <span className="text-sm font-mono uppercase tracking-wide text-gray-500">
                              [NO PROFILE NAME]
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`p-4 rounded-none border-2 shadow-lg font-mono ${
                      isCurrentUser
                        ? 'bg-black border-blue-400 text-white shadow-blue-400/30'
                        : 'bg-black border-gray-400 text-white shadow-gray-400/30'
                    }`}
                  >
                    {/* Reply indicator */}
                    {message.reply_to && (
                      <div className="mb-3 p-2 bg-gray-800 border-l-4 border-blue-400 rounded-r text-sm">
                        <div className="text-blue-400 text-xs font-mono uppercase tracking-wider mb-1">
                          REPLYING TO {message.reply_to.sender_name}
                        </div>
                        <div className="text-gray-300 text-xs truncate">
                          {message.reply_to.content}
                        </div>
                      </div>
                    )}
                    
                    <MessageContent content={message.content} />
                    
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-600">
                      <span className="text-xs text-gray-400 font-mono uppercase tracking-widest">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                      
                      {isCurrentUser && selectedConversationType === 'direct' && (
                        <div className="flex items-center space-x-1">
                          <FontAwesomeIcon
                            icon={(message as PrivateMessage).read ? faCheckDouble : faCheck}
                            className={`text-xs ${
                              (message as PrivateMessage).read ? 'text-green-400' : 'text-gray-400'
                            }`}
                          />
                          <span className="text-xs font-mono uppercase tracking-widest text-gray-400">
                            {(message as PrivateMessage).read ? 'DELIVERED' : 'SENT'}
                          </span>
                        </div>
                      )}
                      
                      {isCurrentUser && selectedConversationType === 'group' && (
                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                          <FontAwesomeIcon icon={faCheckDouble} />
                          <span className="font-mono uppercase tracking-widest">
                            READ: {(message as GroupMessage).read_count || 0}/{(message as GroupMessage).total_members || 1}
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
        
        {/* FBI Typing Indicator */}
        <TypingIndicator typingUsers={typingUsers} className="px-4 py-2 font-mono" />
      </div>

      {/* FBI Message Input */}
      <div className="p-4 border-t-2 border-white bg-black shadow-inner">
        {/* Reply indicator */}
        {replyTo && (
          <div className="mb-3 p-3 bg-gray-800 border-l-4 border-blue-400 rounded-r flex items-center justify-between">
            <div className="flex-1">
              <div className="text-blue-400 text-xs font-mono uppercase tracking-wider mb-1">
                REPLYING TO {replyTo.sender_name}
              </div>
              <div className="text-gray-300 text-sm truncate">
                {replyTo.content}
              </div>
            </div>
            <button
              onClick={() => setReplyTo && setReplyTo(null)}
              className="ml-3 text-gray-400 hover:text-white transition-colors"
              title="Cancel Reply"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex space-x-3">
          <textarea
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              onTyping(); // Emit typing indicator when user types
            }}
            onKeyPress={handleKeyPress}
            placeholder={`Message ${selectedConversationData?.name || 'Unknown'}...`}
            className="flex-1 bg-black text-white border-2 border-white rounded-none p-3 resize-none focus:outline-none focus:border-blue-400 font-mono shadow-lg"
            rows={1}
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <button
            onClick={onSendMessage}
            disabled={!newMessage.trim()}
            className="bg-black text-green-400 border-2 border-green-400 px-6 py-3 rounded-none hover:bg-green-400 hover:text-black disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed transition-all shadow-lg font-mono uppercase tracking-wider"
          >
            <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
            SEND
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;