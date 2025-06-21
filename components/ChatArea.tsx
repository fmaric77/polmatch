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
  faChartBar
} from '@fortawesome/free-solid-svg-icons';
import ProfileAvatar from './ProfileAvatar';
import MessageContent from './MessageContent';
import TypingIndicator from './TypingIndicator';
import PollArtifact from './PollArtifact';
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

interface Poll {
  poll_id: string;
  question: string;
  options: PollOption[];
  created_at: string;
}

interface PollVote {
  _id: string;
  count: number;
}

interface PollResult {
  votes: PollVote[];
  userVote: string | null;
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
  // Voice call props
  onInitiateCall?: (otherUser: { user_id: string; username: string; display_name?: string }) => void;
  // Profile type prop
  activeProfileType: 'basic' | 'love' | 'business';
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
  onInitiateCall,
  activeProfileType
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);

  // Poll state
  const [showPollModal, setShowPollModal] = useState(false);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollResults, setPollResults] = useState<Record<string, PollResult>>({});
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState<string[]>(['', '']);
  const [newPollExpiryHours, setNewPollExpiryHours] = useState<number>(0);

  // Poll functions
  const fetchPolls = useCallback(async (): Promise<void> => {
    if (!selectedConversation) return;
    try {
      const res = await fetch(`/api/groups/${selectedConversation}/polls`);
      const data = await res.json();
      if (data.success) {
        setPolls(data.polls as Poll[]);
        const results: Record<string, PollResult> = {};
        await Promise.all(data.polls.map(async (p: Poll) => {
          const r = await fetch(`/api/groups/${selectedConversation}/polls/${p.poll_id}/votes`);
          const d = await r.json();
          if (d.success) results[p.poll_id] = { votes: d.votes, userVote: d.userVote };
        }));
        setPollResults(results);
      }
    } catch (error) {
      console.error('Error fetching polls:', error);
    }
  }, [selectedConversation]);

  const handleCreatePoll = useCallback(async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const opts = newPollOptions.filter(o => o.trim());
    if (!newPollQuestion.trim() || opts.length < 2) return;
    try {
      const res = await fetch(`/api/groups/${selectedConversation}/polls`, {
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
          question: newPollQuestion, 
          options: opts, 
          expires_in_hours: newPollExpiryHours || undefined,
          profile_type: activeProfileType // Include activeProfileType in poll creation
        })
      });
      const data = await res.json();
      if (data.success) {
        setNewPollQuestion(''); 
        setNewPollOptions(['','']);
        setNewPollExpiryHours(0);
        setShowPollModal(false);
        fetchPolls();
      }
    } catch (error) {
      console.error('Error creating poll:', error);
    }
  }, [selectedConversation, newPollQuestion, newPollOptions, newPollExpiryHours, fetchPolls, activeProfileType]);

  const handleVote = useCallback(async (pollId: string, optionId: string): Promise<void> => {
    try {
      const res = await fetch(`/api/groups/${selectedConversation}/polls/${pollId}/votes`, {
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ optionId })
      });
      if ((await res.json()).success) fetchPolls();
    } catch (error) {
      console.error('Error voting:', error);
    }
  }, [selectedConversation, fetchPolls]);

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
            <button
              onClick={() => {
                setShowPollModal(true);
                fetchPolls();
              }}
              className="p-2 bg-black text-purple-400 border border-purple-400 rounded-none hover:bg-purple-400 hover:text-black transition-all shadow-lg font-mono"
              title="View and Create Polls"
            >
              <FontAwesomeIcon icon={faChartBar} />
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

        {/* Direct Message Actions */}
        {selectedConversationType === 'direct' && selectedConversationData?.user_id && (
          <div className="flex items-center space-x-3">
            <button
              onClick={startVoiceCall}
              className="p-2 bg-black text-green-400 border border-green-400 rounded-none hover:bg-green-400 hover:text-black transition-all shadow-lg font-mono"
              title="Start Voice Call"
            >
              <FontAwesomeIcon icon={faPhone} />
            </button>
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
                
                <div className={`max-w-md break-words ${!isCurrentUser && !showAvatar ? 'ml-12' : ''}`}>
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
                            // For group messages, NEVER use username fallback - always use profile display name
                            const groupMessage = message as GroupMessage;
                            displayName = groupMessage.sender_display_name || '[NO PROFILE NAME]';
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
                    className={`p-4 rounded-none border-2 shadow-lg font-mono break-words ${
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
                        <div className="text-gray-300 text-xs break-words">
                          {message.reply_to.content}
                        </div>
                      </div>
                    )}
                    
                    {/* Poll Artifact */}
                    {(message as GroupMessage).message_type === 'poll' && (message as GroupMessage).poll_data ? (
                      <PollArtifact
                        pollData={(message as GroupMessage).poll_data!}
                        onVote={handleVote}
                        pollResults={pollResults[(message as GroupMessage).poll_data!.poll_id]}
                        currentUser={currentUser}
                      />
                    ) : (
                      <div className="break-words">
                        <MessageContent content={message.content} />
                      </div>
                    )}
                    
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

      {/* Polls Modal */}
      {showPollModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 font-mono">
          <div className="bg-black border-2 border-white rounded-none p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6 border-b-2 border-white pb-4">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">Group Polls</h2>
              <button 
                onClick={() => setShowPollModal(false)} 
                className="text-white hover:text-red-400 transition-colors text-xl font-mono"
              >
                ✕
              </button>
            </div>

            {/* Create Poll Form */}
            <form onSubmit={handleCreatePoll} className="mb-6 bg-black border border-gray-600 rounded-none p-4">
              <div className="text-yellow-400 font-mono uppercase tracking-widest text-xs mb-3">Create New Poll</div>
              <input 
                value={newPollQuestion} 
                onChange={e => setNewPollQuestion(e.target.value)}
                placeholder="Poll question" 
                className="w-full p-2 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-blue-400 font-mono mb-3" 
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
                  className="w-full p-2 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-blue-400 font-mono mb-2" 
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
                  className="w-full p-2 bg-black text-white border-2 border-white rounded-none focus:outline-none focus:border-blue-400 font-mono"
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
                  className="px-4 py-2 bg-black text-green-400 border-2 border-green-400 rounded-none hover:bg-green-400 hover:text-black transition-all font-mono uppercase tracking-wider"
                >
                  Create Poll
                </button>
              </div>
            </form>

            {/* Polls List */}
            <div className="space-y-4">
              {polls.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-gray-400 font-mono uppercase tracking-wide">No polls created yet</div>
                </div>
              ) : (
                polls.map(poll => (
                  <div key={poll.poll_id} className="bg-black border-2 border-gray-600 rounded-none p-4">
                    <div className="text-white font-medium mb-3 font-mono uppercase tracking-wide border-b border-gray-600 pb-2">
                      {poll.question}
                    </div>
                    <div className="space-y-2">
                      {poll.options.map(opt => {
                        const result = pollResults[poll.poll_id];
                        const count = result?.votes.find(v => v._id === opt.option_id)?.count || 0;
                        const isVoted = result?.userVote === opt.option_id;
                        const hasVoted = !!result?.userVote;
                        return (
                          <div key={opt.option_id} className="flex items-center justify-between">
                            <button 
                              onClick={() => handleVote(poll.poll_id, opt.option_id)}
                              disabled={hasVoted}
                              className={`flex-1 text-left p-3 rounded-none border-2 transition-all font-mono ${
                                isVoted 
                                  ? 'bg-green-600 border-green-400 text-white shadow-green-400/30' 
                                  : hasVoted
                                    ? 'bg-gray-800 border-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-black border-white text-white hover:bg-white hover:text-black'
                              }`}
                            >
                              {opt.text}
                            </button>
                            <span className="text-gray-400 text-sm ml-3 font-mono min-w-[3rem] text-right">
                              {count} {count === 1 ? 'vote' : 'votes'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-600 text-xs text-gray-400 font-mono uppercase tracking-widest">
                      Created: {new Date(poll.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatArea;