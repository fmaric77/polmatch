import React, { useRef, useEffect, useState, useCallback } from 'react';
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
  faChevronDown,
  faPhone,
  faChartBar,
  faThumbtack,
  faSpinner
} from '@fortawesome/free-solid-svg-icons';
import ProfileAvatar from './ProfileAvatar';
import StatusIndicator from './StatusIndicator';
import MessageContent from './MessageContent';
import TypingIndicator from './TypingIndicator';
import PollArtifact from './PollArtifact';
import { TypingData } from './hooks/useTypingIndicator';
import { profilePictureCache } from '../lib/profilePictureCache';
import { useCSRFToken } from './hooks/useCSRFToken';
import { UserStatus } from './hooks/useUserStatus';
import { useTheme } from './ThemeProvider';

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

interface PollOption {
  option_id: string;
  text: string;
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
  message_type?: 'text' | 'poll';
  is_pinned?: boolean;
  pinned_at?: string;
  pinned_by?: string;
  poll_data?: {
    poll_id: string;
    question: string;
    options: PollOption[];
    expires_at?: string;
  };
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
  status?: UserStatus;
  custom_message?: string;
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
  sending: boolean;
  isMobile: boolean;
  isConversationsSidebarHidden: boolean;
  setIsConversationsSidebarHidden: (hidden: boolean) => void;
  setIsSidebarVisible: (visible: boolean) => void;
  onMembersClick: () => void;
  onInviteClick: () => void;
  onBannedUsersClick: () => void;
  onCreateChannelClick: () => void;
  onChannelContextMenu: (e: React.MouseEvent, channel: Channel) => void;
  onPinnedMessagesClick?: () => void;
  canManageMembers: boolean;
  // Typing indicator props
  typingUsers: TypingData[];
  onTyping: () => void;
  sessionToken: string | null;
  // Voice call props
  onInitiateCall?: (otherUser: { user_id: string; username: string; display_name?: string }) => void;
  // Profile type prop
  activeProfileType: 'basic' | 'love' | 'business';
  // Messages refresh function
  onRefreshMessages?: () => Promise<void>;
  // Status props
  getUserStatus?: (userId: string) => { status: UserStatus; custom_message?: string } | null;
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
  sending,
  isMobile,
  isConversationsSidebarHidden,
  setIsConversationsSidebarHidden,
  setIsSidebarVisible,
  onMembersClick,
  onInviteClick,
  onBannedUsersClick,
  onCreateChannelClick,
  onChannelContextMenu,
  onPinnedMessagesClick,
  canManageMembers,
  typingUsers,
  onTyping,
  onInitiateCall,
  activeProfileType,
  onRefreshMessages,
  getUserStatus
}) => {
  const { protectedFetch } = useCSRFToken();
  const { theme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);

  // Poll state
  const [showPollModal, setShowPollModal] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState<string[]>(['', '']);
  const [newPollExpiryHours, setNewPollExpiryHours] = useState<number>(0);

  // Poll functions - removed fetchPolls since polls are now only displayed as messages

  const handleCreatePoll = useCallback(async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const opts = newPollOptions.filter(o => o.trim());
    if (!newPollQuestion.trim() || opts.length < 2) return;
    try {
      const res = await protectedFetch(`/api/groups/${selectedConversation}/polls`, {
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
          question: newPollQuestion, 
          options: opts, 
          expires_in_hours: newPollExpiryHours || undefined,
          profile_type: activeProfileType,
          channel_id: selectedChannel // Include channel_id if in a specific channel
        })
      });
      const data = await res.json();
      if (data.success) {
        console.log('Poll created successfully, refreshing messages...', data);
        setNewPollQuestion(''); 
        setNewPollOptions(['','']);
        setNewPollExpiryHours(0);
        setShowPollModal(false);
        // Refresh messages to show the new poll artifact
        if (onRefreshMessages) {
          console.log('Calling onRefreshMessages...');
          await onRefreshMessages();
          console.log('Messages refreshed after poll creation');
        } else {
          console.warn('onRefreshMessages not available');
        }
      } else {
        console.error('Failed to create poll:', data);
      }
    } catch (error) {
      console.error('Error creating poll:', error);
    }
  }, [selectedConversation, selectedChannel, newPollQuestion, newPollOptions, newPollExpiryHours, activeProfileType, onRefreshMessages, protectedFetch]);

  const handleVote = useCallback(async (pollId: string, optionId: string): Promise<void> => {
    try {
      const res = await protectedFetch(`/api/groups/${selectedConversation}/polls/${pollId}/votes`, {
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ optionId })
      });
      if (!(await res.json()).success) {
        console.error('Failed to vote');
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  }, [selectedConversation, protectedFetch]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Start voice call
  const startVoiceCall = async () => {
    if (!selectedConversationData?.user_id || selectedConversationType !== 'direct' || !currentUser || !onInitiateCall) {
      return;
    }

    // Use the new approach: initiate call through parent component
    onInitiateCall({
      user_id: selectedConversationData.user_id,
      username: selectedConversationData.name,
      display_name: selectedConversationData.name
    });
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
      <div className={`flex-1 flex flex-col ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'} font-mono`}>
        {/* FBI Navigation Header */}
        <div className={`p-4 border-b-2 ${theme === 'dark' ? 'border-white' : 'border-black'} rounded-none flex items-center justify-between shadow-lg`}>
          <div className="flex items-center space-x-4">
            {/* Mobile Toggle Buttons */}
            {isMobile && (
              <div className="flex items-center space-x-3">
                {/* Main Navigation Toggle */}
                <button
                  onClick={() => setIsSidebarVisible(true)}
                  className={`p-2 ${theme === 'dark' ? 'bg-black text-green-400 border-green-400 hover:bg-green-400 hover:text-black' : 'bg-white text-green-600 border-green-600 hover:bg-green-600 hover:text-white'} border rounded-none transition-all shadow-lg font-mono uppercase tracking-wider`}
                  title="SHOW NAVIGATION"
                >
                  <FontAwesomeIcon icon={faBars} />
                </button>
                
                {/* Conversations Toggle (only show if conversations are hidden) */}
                {isConversationsSidebarHidden && (
                  <button
                    onClick={() => setIsConversationsSidebarHidden(false)}
                    className={`p-2 ${theme === 'dark' ? 'bg-black text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-black' : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white'} border rounded-none transition-all shadow-lg font-mono uppercase tracking-wider`}
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
                className={`p-2 ${theme === 'dark' ? 'bg-black text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-black' : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white'} border rounded-none transition-all shadow-lg font-mono uppercase tracking-wider`}
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
        
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          {/* Animated Background Grid */}
          <div className="absolute inset-0 opacity-5">
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-px h-full w-full">
              {Array.from({ length: 96 }).map((_, i) => (
                <div 
                  key={i} 
                  className="border border-green-500/20 animate-pulse"
                  style={{ animationDelay: `${i * 0.05}s` }}
                />
              ))}
            </div>
          </div>

          {/* Scanline Effect */}
          <div className="absolute inset-0 pointer-events-none">
            <div 
              className="w-full h-px bg-gradient-to-r from-transparent via-green-400 to-transparent opacity-30 absolute animate-scanline" 
            />
          </div>

          {/* Main Content */}
          <div className={`text-center ${theme === 'dark' ? 'bg-black/80 border-white text-white' : 'bg-white/80 border-black text-black'} border-2 rounded-none p-8 sm:p-12 shadow-2xl relative z-10 backdrop-blur-sm`}>
            {/* Main Title with Glow */}
            <h2 className={`text-3xl sm:text-4xl mb-6 font-mono uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-black'} animate-pulse shadow-lg`} 
                style={{ textShadow: theme === 'dark' ? '0 0 10px rgba(255, 255, 255, 0.5)' : '0 0 10px rgba(0, 0, 0, 0.5)' }}>
              POLMATCH
            </h2>

            {/* Animated Divider */}
            <div className="flex justify-center items-center mb-6">
              <div className={`w-8 h-px ${theme === 'dark' ? 'bg-white/30' : 'bg-black/30'}`}></div>
              <div className={`w-16 h-px ${theme === 'dark' ? 'bg-gradient-to-r from-transparent via-white to-transparent' : 'bg-gradient-to-r from-transparent via-black to-transparent'} mx-2 animate-pulse`}></div>
              <div className={`w-8 h-px ${theme === 'dark' ? 'bg-white/30' : 'bg-black/30'}`}></div>
            </div>

            {/* Status Message */}
            <div className="space-y-3">
              <p className={`${theme === 'dark' ? 'text-green-400' : 'text-green-600'} font-mono text-sm uppercase tracking-widest animate-pulse`}>
                SYSTEM READY
              </p>
              <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} font-mono text-sm`}>
                Select a conversation to start messaging
              </p>
            </div>
          </div>

          {/* CSS for custom animations */}
          <style jsx>{`
            @keyframes scanline {
              0% { transform: translateY(-100vh); opacity: 0; }
              50% { opacity: 0.3; }
              100% { transform: translateY(100vh); opacity: 0; }
            }
            .animate-scanline {
              animation: scanline 3s linear infinite;
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'} relative font-mono`}>
      {/* Loading Overlay for Context Switches */}
      {contextSwitchLoading && (
        <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-black/90 border-white' : 'bg-white/90 border-black'} flex items-center justify-center z-50 border-2 rounded-none`}>
          <div className={`${theme === 'dark' ? 'bg-black border-yellow-400' : 'bg-white border-yellow-600'} border-2 rounded-none p-4 shadow-2xl`}>
            <div className={`${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'} text-xl font-mono uppercase tracking-wider`}>Loading...</div>
          </div>
        </div>
      )}

      {/* FBI Chat Header */}
      <div className={`p-4 border-b-2 ${theme === 'dark' ? 'border-white' : 'border-black'} rounded-none flex items-center justify-between shadow-lg`}>
        <div className="flex items-center space-x-4">
          {/* Mobile Toggle Buttons */}
          {isMobile && (
            <div className="flex items-center space-x-3">
              {/* Main Navigation Toggle */}
              <button
                onClick={() => setIsSidebarVisible(true)}
                className={`p-2 ${theme === 'dark' ? 'bg-black text-green-400 border-green-400 hover:bg-green-400 hover:text-black' : 'bg-white text-green-600 border-green-600 hover:bg-green-600 hover:text-white'} border rounded-none transition-all shadow-lg font-mono uppercase tracking-wider`}
                title="SHOW NAVIGATION"
              >
                <FontAwesomeIcon icon={faBars} />
              </button>
              
            </div>
          )}

          {/* Conversation Info */}
          {selectedConversationData?.type === 'direct' && selectedConversationData.user_id ? (
            <div className={`border-2 ${theme === 'dark' ? 'border-white' : 'border-black'} rounded-none p-1 shadow-lg relative`}>
              <ProfileAvatar userId={selectedConversationData.user_id} size={32} />
              {/* Status Indicator for Direct Chat Header */}
              {getUserStatus && (() => {
                const userStatus = getUserStatus(selectedConversationData.user_id);
                return userStatus ? (
                  <div className="absolute -bottom-1 -right-1">
                    <StatusIndicator 
                      status={userStatus.status} 
                      size="small" 
                      inline 
                      className="border-2 border-black"
                    />
                  </div>
                ) : null;
              })()}
            </div>
          ) : (
            <div className={`w-8 h-8 ${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border-2 rounded-none flex items-center justify-center shadow-lg`}>
              <FontAwesomeIcon 
                icon={selectedConversationType === 'group' ? faHashtag : faUsers} 
                className={`${theme === 'dark' ? 'text-white' : 'text-black'} text-sm`}
              />
            </div>
          )}
          
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-mono uppercase tracking-wider">
                {selectedConversationData?.name || 'Unknown Contact'}
                {selectedConversationType === 'group' && selectedChannel && groupChannels.length > 0 && (
                  <>
                    <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mx-2`}>/</span>
                    <span className={`${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                      #{groupChannels.find(ch => ch.channel_id === selectedChannel)?.name || 'general'}
                    </span>
                  </>
                )}
              </h2>
              {/* Status indicator with label for direct conversations */}
              {selectedConversationType === 'direct' && selectedConversationData?.user_id && getUserStatus && (() => {
                const userStatus = getUserStatus(selectedConversationData.user_id);
                return userStatus ? (
                  <StatusIndicator 
                    status={userStatus.status} 
                    size="small" 
                    showLabel 
                    customMessage={userStatus.custom_message}
                  />
                ) : null;
              })()}
            </div>
            {selectedConversationData?.members_count && (
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} font-mono`}>
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
              className={`p-2 ${theme === 'dark' ? 'bg-black text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-black' : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white'} border rounded-none transition-all shadow-lg font-mono`}
              title="View Members"
            >
              <FontAwesomeIcon icon={faUsers} />
            </button>
            <button
              onClick={() => setShowPollModal(true)}
              className={`p-2 ${theme === 'dark' ? 'bg-black text-purple-400 border-purple-400 hover:bg-purple-400 hover:text-black' : 'bg-white text-purple-600 border-purple-600 hover:bg-purple-600 hover:text-white'} border rounded-none transition-all shadow-lg font-mono`}
              title="Create Polls"
            >
              <FontAwesomeIcon icon={faChartBar} />
            </button>
            <button
              onClick={onPinnedMessagesClick}
              className={`p-2 ${theme === 'dark' ? 'bg-black text-yellow-400 border-yellow-400 hover:bg-yellow-400 hover:text-black' : 'bg-white text-yellow-600 border-yellow-600 hover:bg-yellow-600 hover:text-white'} border rounded-none transition-all shadow-lg font-mono`}
              title="View Pinned Messages"
            >
              <FontAwesomeIcon icon={faThumbtack} />
            </button>
            {canManageMembers && (
              <>
                <button
                  onClick={onInviteClick}
                  className={`p-2 ${theme === 'dark' ? 'bg-black text-green-400 border-green-400 hover:bg-green-400 hover:text-black' : 'bg-white text-green-600 border-green-600 hover:bg-green-600 hover:text-white'} border rounded-none transition-all shadow-lg font-mono`}
                  title="Invite User"
                >
                  <FontAwesomeIcon icon={faUserPlus} />
                </button>
                <button
                  onClick={onBannedUsersClick}
                  className={`p-2 ${theme === 'dark' ? 'bg-black text-red-400 border-red-400 hover:bg-red-400 hover:text-black' : 'bg-white text-red-600 border-red-600 hover:bg-red-600 hover:text-white'} border rounded-none transition-all shadow-lg font-mono`}
                  title="Banned Users"
                >
                  <FontAwesomeIcon icon={faBan} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Direct Message Actions */}
        {selectedConversationType === 'direct' && selectedConversationData?.user_id && (
          <div className="flex items-center space-x-3">
            <button
              onClick={startVoiceCall}
              className={`p-2 ${theme === 'dark' ? 'bg-black text-green-400 border-green-400 hover:bg-green-400 hover:text-black' : 'bg-white text-green-600 border-green-600 hover:bg-green-600 hover:text-white'} border rounded-none transition-all shadow-lg font-mono`}
              title="Start Voice Call"
            >
              <FontAwesomeIcon icon={faPhone} />
            </button>
          </div>
        )}
      </div>

      {/* Group Channels Navigation */}
      {selectedConversationType === 'group' && groupChannels.length > 0 && (
        <div className={`px-4 py-3 border-b-2 ${theme === 'dark' ? 'border-gray-700 bg-black' : 'border-gray-300 bg-white'} shadow-inner`}>
          <div className="mb-2 flex items-center justify-between">
            <div className={`${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'} font-mono uppercase tracking-widest text-xs`}>Channels</div>
            {isMobile && groupChannels.length > 3 && (
              <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} font-mono`}>
                {groupChannels.findIndex(ch => ch.channel_id === selectedChannel) + 1}/{groupChannels.length}
              </div>
            )}
          </div>
          
          {/* Mobile: Dropdown only */}
          {isMobile ? (
            <div className="relative">
              <button
                onClick={() => setShowChannelDropdown(!showChannelDropdown)}
                className={`w-full flex items-center justify-between ${theme === 'dark' ? 'bg-blue-600 border-blue-400' : 'bg-blue-500 border-blue-300'} border-2 px-3 py-2 rounded-none transition-all`}
              >
                <div className="flex items-center space-x-2">
                  <FontAwesomeIcon icon={faHashtag} className={`text-xs ${theme === 'dark' ? 'text-white' : 'text-white'}`} />
                  <span className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-white'} font-mono uppercase tracking-wide`}>
                    {groupChannels.find(ch => ch.channel_id === selectedChannel)?.name || 'general'}
                  </span>
                </div>
                <FontAwesomeIcon 
                  icon={faChevronDown} 
                  className={`text-xs ${theme === 'dark' ? 'text-white' : 'text-white'} transition-transform ${showChannelDropdown ? 'rotate-180' : ''}`}
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
                        className={`w-full flex items-center space-x-2 px-3 py-2 ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'} border-b transition-colors font-mono text-sm ${
                          selectedChannel === channel.channel_id
                            ? (theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                            : (theme === 'dark' ? 'bg-black text-gray-300 hover:bg-gray-800 hover:text-white' : 'bg-white text-gray-700 hover:bg-gray-100 hover:text-black')
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
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
        {channelLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className={`${theme === 'dark' ? 'bg-black border-yellow-400' : 'bg-white border-yellow-600'} border-2 rounded-none p-4 shadow-2xl`}>
              <div className={`${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'} font-mono uppercase tracking-wider`}>Loading messages...</div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className={`text-center ${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border-2 rounded-none p-6 shadow-2xl`}>
              <p className="mb-2 font-mono uppercase tracking-wide">No messages yet</p>
              <div className={`w-12 h-px ${theme === 'dark' ? 'bg-white' : 'bg-black'} mx-auto mb-3`}></div>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} font-mono`}>Start the conversation</p>
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

            // Generate a robust, unique key for React rendering
            const messageKey = (() => {
              const privateMsg = message as PrivateMessage;
              const groupMsg = message as GroupMessage;
              
              // For private messages, prefer _id, fallback to a combination of fields
              if (privateMsg._id) {
                return `private-${privateMsg._id}`;
              }
              
              // For group messages, prefer message_id, fallback to a combination of fields
              if (groupMsg.message_id) {
                return `group-${groupMsg.message_id}`;
              }
              
              // Fallback: create a unique key from timestamp and sender
              return `msg-${message.sender_id}-${message.timestamp}-${index}`;
            })();

            return (
              <div
                key={messageKey}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} ${
                  showAvatar ? 'mt-4' : 'mt-1'
                }`}
                onContextMenu={e => onMessageContextMenu(e, message)}
              >
                {!isCurrentUser && showAvatar && (
                  <div className="mr-3">
                    <div className={`border-2 ${theme === 'dark' ? 'border-white' : 'border-black'} rounded-none p-1 shadow-lg`}>
                      <ProfileAvatar userId={message.sender_id} size={32} />
                    </div>
                  </div>
                )}
                
                <div className={`max-w-md break-words ${!isCurrentUser && !showAvatar ? 'ml-12' : ''}`}>
                  {!isCurrentUser && showAvatar && (
                    <div className={`mb-2 ${theme === 'dark' ? 'bg-black border-gray-500' : 'bg-white border-gray-400'} border rounded-none p-2 shadow-lg`}>
                      <div className="flex items-center space-x-2">
                        {(() => {
                          let displayName = null;
                          if (selectedConversationType === 'direct') {
                            // For direct messages, use the conversation name (which is the other user's display name)
                            displayName = selectedConversationData?.name && selectedConversationData.name !== 'Unknown Contact' 
                              ? selectedConversationData.name 
                              : null;
                          } else {
                            // For group messages, NEVER use username fallback - always use profile display name
                            const groupMessage = message as GroupMessage;
                            displayName = groupMessage.sender_display_name || '[NO PROFILE NAME]';
                          }
                          
                          return displayName ? (
                            <span className={`text-sm font-mono uppercase tracking-wide ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                              {displayName}
                            </span>
                          ) : (
                            <span className={`text-sm font-mono uppercase tracking-wide ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                              [NO PROFILE NAME]
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`p-4 rounded-none border-2 shadow-lg font-mono break-words ${
                      isCurrentUser
                        ? (theme === 'dark' ? 'bg-black border-blue-400 text-white shadow-blue-400/30' : 'bg-blue-100 border-blue-600 text-black shadow-blue-600/30')
                        : (theme === 'dark' ? 'bg-black border-gray-400 text-white shadow-gray-400/30' : 'bg-gray-100 border-gray-600 text-black shadow-gray-600/30')
                    }`}
                  >
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
                    
                    {/* Message Content - Poll Artifact or Regular Content */}
                    {(() => {
                      const groupMessage = message as GroupMessage;
                      
                      if (groupMessage.message_type === 'poll' && groupMessage.poll_data) {
                        return (
                          <PollArtifact
                            pollData={groupMessage.poll_data!}
                            onVote={handleVote}
                            pollResults={undefined}
                            currentUser={currentUser}
                            groupId={selectedConversation}
                          />
                        );
                      } else {
                        return (
                          <div className="break-words">
                            <MessageContent content={groupMessage.content} />
                          </div>
                        );
                      }
                    })()}
                    
                    <div className={`flex items-center justify-between mt-3 pt-2 border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-400'}`}>
                      <div className="flex items-center space-x-3">
                        <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} font-mono uppercase tracking-widest`}>
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                        {/* Pin indicator for group messages */}
                        {selectedConversationType === 'group' && (message as GroupMessage).is_pinned && (
                          <div className={`flex items-center space-x-1 text-xs ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>
                            <FontAwesomeIcon icon={faThumbtack} />
                            <span className="font-mono uppercase tracking-widest">PINNED</span>
                          </div>
                        )}
                      </div>
                      
                      {isCurrentUser && selectedConversationType === 'direct' && (
                        <div className="flex items-center space-x-1">
                          <FontAwesomeIcon
                            icon={(message as PrivateMessage).read ? faCheckDouble : faCheck}
                            className={`text-xs ${
                              (message as PrivateMessage).read 
                                ? (theme === 'dark' ? 'text-green-400' : 'text-green-600') 
                                : (theme === 'dark' ? 'text-gray-400' : 'text-gray-600')
                            }`}
                          />
                          <span className={`text-xs font-mono uppercase tracking-widest ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            {(message as PrivateMessage).read ? 'DELIVERED' : 'SENT'}
                          </span>
                        </div>
                      )}
                      
                      {isCurrentUser && selectedConversationType === 'group' && (
                        <div className={`flex items-center space-x-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
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
              <div className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} text-sm truncate`}>
                {replyTo.content}
              </div>
            </div>
            <button
              onClick={() => setReplyTo && setReplyTo(null)}
              className={`ml-3 ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'} transition-colors`}
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
            className={`flex-1 ${theme === 'dark' ? 'bg-black text-white border-white focus:border-blue-400' : 'bg-white text-black border-black focus:border-blue-600'} border-2 rounded-none p-3 resize-none focus:outline-none font-mono shadow-lg`}
            rows={1}
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <button
            onClick={onSendMessage}
            disabled={!newMessage.trim() || sending}
            className={`${theme === 'dark' ? 'bg-black text-green-400 border-green-400 hover:bg-green-400 hover:text-black disabled:border-gray-600 disabled:text-gray-600' : 'bg-white text-green-600 border-green-600 hover:bg-green-600 hover:text-white disabled:border-gray-400 disabled:text-gray-400'} border-2 px-6 py-3 rounded-none disabled:cursor-not-allowed transition-all shadow-lg font-mono uppercase tracking-wider`}
          >
            <FontAwesomeIcon icon={sending ? faSpinner : faPaperPlane} className={`mr-2 ${sending ? 'animate-spin' : ''}`} />
            {sending ? 'SENDING...' : 'SEND'}
          </button>
        </div>
      </div>

      {/* Polls Modal */}
      {showPollModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 font-mono">
          <div className={`${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border-2 rounded-none p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl`}>
            <div className={`flex items-center justify-between mb-6 border-b-2 ${theme === 'dark' ? 'border-white' : 'border-black'} pb-4`}>
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'} uppercase tracking-wider`}>Group Polls</h2>
              <button 
                onClick={() => setShowPollModal(false)} 
                className={`${theme === 'dark' ? 'text-white hover:text-red-400' : 'text-black hover:text-red-500'} transition-colors text-xl font-mono`}
              >
                ✕
              </button>
            </div>

            {/* Create Poll Form */}
            <form onSubmit={handleCreatePoll} className={`mb-6 ${theme === 'dark' ? 'bg-black border-gray-600' : 'bg-white border-gray-400'} border rounded-none p-4`}>
              <div className="text-yellow-400 font-mono uppercase tracking-widest text-xs mb-3">Create New Poll</div>
              <input 
                value={newPollQuestion} 
                onChange={e => setNewPollQuestion(e.target.value)}
                placeholder="Poll question" 
                className={`w-full p-2 ${theme === 'dark' ? 'bg-black text-white border-white' : 'bg-white text-black border-black'} border-2 rounded-none focus:outline-none focus:border-blue-400 font-mono mb-3`}
                required 
              />
              {newPollOptions.map((opt, idx) => (
                <input 
                  key={idx} 
                  value={opt} 
                  onChange={e => {
                    const arr = [...newPollOptions]; 
                    arr[idx] = e.target.value; 
                    setNewPollOptions(arr);
                  }} 
                  placeholder={`Option ${idx + 1}`} 
                  className={`w-full p-2 ${theme === 'dark' ? 'bg-black text-white border-white' : 'bg-white text-black border-black'} border-2 rounded-none focus:outline-none focus:border-blue-400 font-mono mb-2`}
                  required 
                />
              ))}
              <button 
                type="button" 
                onClick={() => setNewPollOptions([...newPollOptions, ''])}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors mb-4 font-mono uppercase tracking-wide"
              >
                + Add Option
              </button>
              
              {/* Expiry Date Input */}
              <div className="mb-4">
                <label className="block text-xs text-yellow-400 font-mono uppercase tracking-widest mb-2">
                  Poll Expiry (Optional)
                </label>
                <select 
                  value={newPollExpiryHours} 
                  onChange={e => setNewPollExpiryHours(Number(e.target.value))}
                  className={`w-full p-2 ${theme === 'dark' ? 'bg-black text-white border-white' : 'bg-white text-black border-black'} border-2 rounded-none focus:outline-none focus:border-blue-400 font-mono`}
                >
                  <option value={0}>No expiry (permanent)</option>
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>1 day</option>
                  <option value={72}>3 days</option>
                  <option value={168}>1 week</option>
                </select>
              </div>
              
              <div className="flex space-x-3">
                <button 
                  type="submit" 
                  className={`px-4 py-2 ${theme === 'dark' ? 'bg-black text-green-400 border-green-400 hover:bg-green-400 hover:text-black' : 'bg-white text-green-600 border-green-600 hover:bg-green-600 hover:text-white'} border-2 rounded-none transition-all font-mono uppercase tracking-wider`}
                >
                  Create Poll
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowPollModal(false)}
                  className={`px-4 py-2 ${theme === 'dark' ? 'bg-black text-red-400 border-red-400 hover:bg-red-400 hover:text-black' : 'bg-white text-red-500 border-red-500 hover:bg-red-500 hover:text-white'} border-2 rounded-none transition-all font-mono uppercase tracking-wider`}
                >
                  Cancel
                </button>
              </div>
            </form>

            <div className={`text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} font-mono text-sm`}>
              <div className={`border ${theme === 'dark' ? 'border-gray-600 bg-gray-900/50' : 'border-gray-400 bg-gray-100/50'} p-4 rounded-none`}>
                <div className={`${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'} mb-2`}>📊 POLL CREATION</div>
                <div className="text-xs uppercase tracking-wider">
                  Created polls will appear as message artifacts in the chat
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatArea;