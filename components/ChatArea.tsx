import React, { useRef, useEffect } from 'react';
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
  faEnvelope
} from '@fortawesome/free-solid-svg-icons';
import ProfileAvatar from './ProfileAvatar';
import MessageContent from './MessageContent';
import TypingIndicator from './TypingIndicator';
import { TypingData } from './hooks/useTypingIndicator';
import { profilePictureCache } from '../lib/profilePictureCache';

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
              <div className="text-red-500 font-mono uppercase tracking-widest text-xs">CLASSIFIED</div>
              <div className="w-px h-6 bg-white"></div>
              <h2 className="text-lg font-mono uppercase tracking-wider">SECURE MESSAGING</h2>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center bg-black border-2 border-white rounded-none p-8 shadow-2xl">
            <div className="mb-4 text-red-500 font-mono uppercase tracking-widest text-xs">CLASSIFIED SYSTEM</div>
            <h2 className="text-2xl mb-4 font-mono uppercase tracking-wider">FEDERAL COMMUNICATION NETWORK</h2>
            <div className="w-16 h-px bg-white mx-auto mb-4"></div>
            <p className="text-gray-300 font-mono uppercase tracking-wide text-sm">SELECT CONVERSATION TO INITIATE SECURE TRANSMISSION</p>
            <div className="mt-6 text-xs text-gray-500 font-mono uppercase tracking-wider">SECURITY CLEARANCE: AUTHORIZED</div>
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
            <div className="text-yellow-400 text-xl font-mono uppercase tracking-wider">ESTABLISHING SECURE CONNECTION...</div>
            <div className="mt-2 text-xs text-gray-400 font-mono uppercase tracking-widest">ENCRYPTION PROTOCOL ACTIVE</div>
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
            <div className="flex items-center space-x-2 mb-1">
              <div className="text-red-500 font-mono uppercase tracking-widest text-xs">SECURE CHANNEL</div>
              <div className="w-px h-4 bg-white"></div>
            </div>
            <h2 className="text-lg font-mono uppercase tracking-wider">
              {selectedConversationData?.name || 'UNKNOWN CONTACT'}
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
              <p className="text-sm text-gray-400 font-mono uppercase tracking-wide">
                ACTIVE AGENTS: {selectedConversationData.members_count}
              </p>
            )}
          </div>
        </div>

        {/* Group Actions */}
        {selectedConversationType === 'group' && (
          <div className="flex items-center space-x-3">
            <div className="text-green-400 font-mono uppercase tracking-widest text-xs mr-4">OPERATIONS</div>
            <button
              onClick={onMembersClick}
              className="p-2 bg-black text-blue-400 border border-blue-400 rounded-none hover:bg-blue-400 hover:text-black transition-all shadow-lg font-mono"
              title="VIEW AGENTS"
            >
              <FontAwesomeIcon icon={faUsers} />
            </button>
            {canManageMembers && (
              <>
                <button
                  onClick={onInviteClick}
                  className="p-2 bg-black text-green-400 border border-green-400 rounded-none hover:bg-green-400 hover:text-black transition-all shadow-lg font-mono"
                  title="RECRUIT AGENT"
                >
                  <FontAwesomeIcon icon={faUserPlus} />
                </button>
                <button
                  onClick={onBannedUsersClick}
                  className="p-2 bg-black text-red-400 border border-red-400 rounded-none hover:bg-red-400 hover:text-black transition-all shadow-lg font-mono"
                  title="TERMINATED AGENTS"
                >
                  <FontAwesomeIcon icon={faBan} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* FBI Group Channels Navigation */}
      {selectedConversationType === 'group' && groupChannels.length > 0 && (
        <div className="px-4 py-3 border-b-2 border-gray-700 bg-black shadow-inner">
          <div className="mb-2">
            <div className="text-yellow-400 font-mono uppercase tracking-widest text-xs">SECURE CHANNELS</div>
          </div>
          <div className="flex items-center space-x-3 overflow-x-auto">
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
        </div>
      )}

      {/* FBI Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black">
        {channelLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="bg-black border-2 border-yellow-400 rounded-none p-4 shadow-2xl">
              <div className="text-yellow-400 font-mono uppercase tracking-wider">DECRYPTING MESSAGES...</div>
              <div className="mt-2 text-xs text-gray-400 font-mono uppercase tracking-widest">SECURE PROTOCOL ACTIVE</div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center bg-black border-2 border-white rounded-none p-6 shadow-2xl">
              <div className="mb-3 text-red-500 font-mono uppercase tracking-widest text-xs">CLASSIFIED CHANNEL</div>
              <p className="mb-2 font-mono uppercase tracking-wide">NO TRANSMISSIONS RECORDED</p>
              <div className="w-12 h-px bg-white mx-auto mb-3"></div>
              <p className="text-sm text-gray-400 font-mono uppercase tracking-wide">INITIATE SECURE COMMUNICATION</p>
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
                        <span className="text-sm font-mono uppercase tracking-wide text-blue-400">
                          {selectedConversationType === 'direct' 
                            ? `AGENT-${(message as PrivateMessage).sender_profile_data?.display_name || message.sender_id.substring(0, 8).toUpperCase()}`
                            : `AGENT-${(message as GroupMessage).sender_display_name || (message as GroupMessage).sender_username || message.sender_id.substring(0, 8).toUpperCase()}`
                          }
                        </span>
                        <div className="w-px h-3 bg-gray-500"></div>
                        <span className="text-xs text-gray-400 font-mono uppercase tracking-widest">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
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
        <div className="mb-2">
          <div className="text-green-400 font-mono uppercase tracking-widest text-xs">SECURE INPUT TERMINAL</div>
        </div>
        <div className="flex space-x-3">
          <textarea
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              onTyping(); // Emit typing indicator when user types
            }}
            onKeyPress={handleKeyPress}
            placeholder={`TRANSMIT TO ${selectedConversationData?.name?.toUpperCase() || 'UNKNOWN'}...`}
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
        <div className="mt-2 text-xs text-gray-500 font-mono uppercase tracking-widest">ENCRYPTION: AES-256 | STATUS: SECURE</div>
      </div>
    </div>
  );
};

export default ChatArea;