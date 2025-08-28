import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPaperPlane,
  faHashtag,
  faUsers,
  faUserPlus,
  faCheck,
  faCheckDouble,
  faBan,
  faEnvelope,
  faChevronDown,
  faPhone,
  faChartBar,
  faThumbtack,
  faSpinner,
  faBell,
  faCog,
  faEllipsisVertical,
  faLock,
  faLockOpen
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
import e2ee from '../lib/e2ee';
import reactions, { ReactionsState } from '../lib/reactions';

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
  onSendMessage: (overrideContent?: string) => void;
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
  // Invitations
  invitationsCount: number;
  onInvitationsClick: () => void;
  // Reactions
  reactions?: ReactionsState;
  onToggleReaction?: (messageId: string, emoji: string) => void;
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
  getUserStatus,
  invitationsCount,
  onInvitationsClick
  , reactions: reactionsState,
  onToggleReaction
}) => {
  const { protectedFetch } = useCSRFToken();
  const { theme } = useTheme();
  // Conversation E2EE key context helpers
  const dmKeyId = (() => {
    if (selectedConversationType !== 'direct' || !currentUser || !selectedConversation) return null;
    return e2ee.getKeyId(activeProfileType, currentUser.user_id, selectedConversation);
  })();
  // Keep E2EE flags in state so UI reacts immediately to localStorage changes
  const [e2eeEnabled, setE2eeEnabled] = useState<boolean>(() => (dmKeyId ? e2ee.isEnabled(dmKeyId) : false));
  const [hasDmKey, setHasDmKey] = useState<boolean>(() => (dmKeyId ? e2ee.hasKey(dmKeyId) : false));

  const refreshE2eeFlags = useCallback((): void => {
    if (!dmKeyId) {
      setE2eeEnabled(false);
      setHasDmKey(false);
      return;
    }
    setE2eeEnabled(e2ee.isEnabled(dmKeyId));
    setHasDmKey(e2ee.hasKey(dmKeyId));
  }, [dmKeyId]);

  // Refresh on conversation switches and storage updates
  useEffect(() => {
    refreshE2eeFlags();
  }, [refreshE2eeFlags]);

  useEffect(() => {
    if (typeof window === 'undefined' || !dmKeyId) return;
    const handleStorage = (ev: StorageEvent): void => {
      if (!ev.key) return;
      if (ev.key.endsWith(dmKeyId)) {
        refreshE2eeFlags();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [dmKeyId, refreshE2eeFlags]);

  // On first opening a DM, if E2EE enabled locally and no key exists on other side yet, embed a one-time key share
  // We implement this by intercepting the first inbound share message and storing the key; generation and send is triggered by UI toggle.

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [unreadMentionsCount, setUnreadMentionsCount] = useState<number>(0);

  // Poll state
  const [showPollModal, setShowPollModal] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState<string[]>(['', '']);
  const [newPollExpiryHours, setNewPollExpiryHours] = useState<number>(0);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState<boolean>(false);
  const [showKeyMenu, setShowKeyMenu] = useState<boolean>(false);
  const [keyNotice, setKeyNotice] = useState<string>('');
  // Reactions picker state
  const [openReactionsFor, setOpenReactionsFor] = useState<string | null>(null);
  const quickEmojis: readonly string[] = ['👍','❤️','😂','😮','😢','👎'] as const;

  // Mention suggestion state
  interface MentionUser { user_id: string; username: string; display_name?: string; }
  interface GroupMember { user_id: string; username: string; display_name?: string; }
  interface UserListResponse { success: boolean; user?: MentionUser; users?: MentionUser[]; }
  interface GroupMembersResponse { success: boolean; members?: GroupMember[]; }
  
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionUser[]>([]);
  // Track last processed special E2EE control messages to avoid repeated side-effects
  const lastProcessedDisableRef = useRef<string | null>(null);
  const lastProcessedShareRef = useRef<string | null>(null);
  
  // Reference for the textarea to handle cursor position
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  // Auto-resize textarea (Discord-like): grow with content up to a max height
  const adjustTextareaHeight = useCallback((): void => {
    const el = textareaRef.current;
    if (!el) return;
    const min = 48; // px
    const max = 240; // px, cap like Discord
    el.style.height = 'auto';
    const next = Math.min(Math.max(el.scrollHeight, min), max);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
  }, []);

  // Helpers for mention notifications
  const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isUserMentioned = (content: string, username: string): boolean => {
    if (!username) return false;
    const re = new RegExp(`@${escapeRegExp(username)}(\\b|$)`, 'i');
    return re.test(content);
  };
  const getMentionsSeenKey = (): string => {
    const parts = [
      'mentionsSeen',
      activeProfileType,
      selectedConversationType,
      selectedConversation || 'none',
    ];
    // Scope by channel for groups
    if (selectedConversationType === 'group' && selectedChannel) parts.push(selectedChannel);
    return parts.join(':');
  };
  const markMentionsSeen = (): void => {
    if (typeof window === 'undefined') return;
    const key = getMentionsSeenKey();
    try {
      window.localStorage.setItem(key, `${Date.now()}`);
    } catch {
      // ignore storage errors
    }
    setUnreadMentionsCount(0);
  };

  // Function to detect and show mention suggestions
  const handleMention = (text: string, cursorPos: number) => {
    console.log('handleMention called:', { text, cursorPos, users: users.length });
    const uptoCursor = text.slice(0, cursorPos);
    const atIndex = uptoCursor.lastIndexOf('@');
    console.log('atIndex:', atIndex, 'uptoCursor:', uptoCursor);
    
    if (atIndex >= 0) {
      const query = uptoCursor.slice(atIndex + 1);
      console.log('mention query:', query);
      // Allow letters, numbers, and underscores for usernames
      if (/^\w*$/.test(query)) {
        // Show all users when just '@', otherwise filter by query
        const matches = query === ''
          ? users
          : users.filter(u =>
              u.username.toLowerCase().startsWith(query.toLowerCase()) ||
              (u.display_name && u.display_name.toLowerCase().startsWith(query.toLowerCase()))
            );
        console.log('mention matches found:', matches.length, matches);
        setMentionSuggestions(matches);
        setShowMentionSuggestions(matches.length > 0);
        setSelectedMentionIndex(0); // Reset selection to first item
        return;
      } else {
        console.log('query failed regex test:', query);
      }
    }
    setShowMentionSuggestions(false);
  };

  // Function to handle keyboard navigation in mention dropdown
  const handleMentionKeyDown = (e: React.KeyboardEvent) => {
    if (!showMentionSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev < mentionSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedMentionIndex(prev => 
          prev > 0 ? prev - 1 : mentionSuggestions.length - 1
        );
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (mentionSuggestions[selectedMentionIndex]) {
          insertMention(mentionSuggestions[selectedMentionIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowMentionSuggestions(false);
        break;
    }
  };

  // Function to insert mention into textarea
  const insertMention = (user: MentionUser) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const text = newMessage;
    const uptoCursor = text.slice(0, cursorPos);
    const atIndex = uptoCursor.lastIndexOf('@');
    
    if (atIndex >= 0) {
      const before = text.slice(0, atIndex);
      const after = text.slice(cursorPos);
      const mention = `@${user.username} `;
      const newText = before + mention + after;
      
      setNewMessage(newText);
      setShowMentionSuggestions(false);
      
      // Set cursor position after the mention
      setTimeout(() => {
        const newCursorPos = atIndex + mention.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }
  };
  // Poll functions - removed fetchPolls since polls are now only displayed as messages

  // Fetch users for mention suggestions based on conversation type
  useEffect(() => {
    console.log('🔍 Fetching users for mentions:', { 
      selectedConversation, 
      selectedConversationType, 
      user_id: selectedConversationData?.user_id 
    });
    
    if (!selectedConversation || !selectedConversationType) {
      setUsers([]);
      return;
    }

    if (selectedConversationType === 'direct') {
      // For direct messages, only allow mentioning the other person
      if (selectedConversationData?.user_id) {
        console.log('📞 Fetching direct message partner:', selectedConversationData.user_id);
        // First try to fetch the specific user
        fetch(`/api/users/${selectedConversationData.user_id}`)
          .then(res => {
            console.log('👤 User fetch response:', res.status, res.ok);
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            console.log('👤 User fetch data:', data);
            if (data.success && data.user) {
              console.log('✅ Fetched direct message partner for mentions:', data.user);
              setUsers([data.user]);
            } else {
              console.log('⚠️ User fetch unsuccessful, falling back to users list');
              throw new Error('User not found in specific endpoint');
            }
          })
          .catch(err => {
            console.log('💥 User fetch failed, trying fallback:', err.message);
            // Fallback: fetch all users and filter for the conversation partner
            return fetch(`/api/users/list?profile_type=${activeProfileType}`)
              .then(res => {
                console.log('📋 Users list response:', res.status, res.ok);
                if (!res.ok) {
                  throw new Error(`HTTP ${res.status}`);
                }
                return res.json();
              })
              .then((data: UserListResponse) => {
                console.log('📋 Users list data:', data);
                if (data && data.success && data.users) {
                  const otherUser = data.users.find((user: MentionUser) => 
                    user.user_id === selectedConversationData.user_id
                  );
                  if (otherUser) {
                    console.log('✅ Found conversation partner in users list:', otherUser);
                    setUsers([otherUser]);
                  } else {
                    console.log('❌ Could not find user in users list');
                    setUsers([]);
                  }
                } else {
                  console.log('❌ Users list fetch unsuccessful');
                  setUsers([]);
                }
              })
              .catch(fallbackErr => {
                console.error('💥 Both user fetch methods failed:', fallbackErr);
                setUsers([]);
              });
          });
      } else {
        setUsers([]);
      }
    } else if (selectedConversationType === 'group') {
      // For group messages, fetch group members
      fetch(`/api/groups/${selectedConversation}/members`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.json();
        })
        .then((data: GroupMembersResponse) => {
          if (data.success && data.members) {
            console.log('Fetched group members for mentions:', data.members);
            // Filter out current user from mentions (can't mention yourself)
            const otherMembers = data.members.filter((member: GroupMember) => 
              member.user_id !== currentUser?.user_id
            );
            setUsers(otherMembers);
          } else {
            // Fallback: fetch all users (not ideal but better than nothing)
            console.log('Falling back to all users list for group');
            return fetch(`/api/users/list?profile_type=${activeProfileType}`)
              .then(res => {
                if (!res.ok) {
                  throw new Error(`HTTP ${res.status}`);
                }
                return res.json();
              })
              .then((data: UserListResponse) => {
                if (data && data.success && data.users) {
                  // Filter out current user
                  const otherUsers = data.users.filter((user: MentionUser) => 
                    user.user_id !== currentUser?.user_id
                  );
                  console.log('Using all users as fallback for group mentions:', otherUsers.length);
                  setUsers(otherUsers);
                } else {
                  setUsers([]);
                }
              });
          }
        })
        .catch(err => {
          console.error('Failed to fetch group members:', err);
          setUsers([]);
        });
    }
  }, [selectedConversation, selectedConversationType, selectedConversationData?.user_id, currentUser?.user_id, activeProfileType]);

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

  // E2EE actions only for DMs
  const e2eeActions = {
    enabled(): boolean {
      return !!dmKeyId && e2ee.isEnabled(dmKeyId);
    },
    toggle(): void {
      if (!dmKeyId) return;
      const next = !e2ee.isEnabled(dmKeyId);
      e2ee.setEnabled(dmKeyId, next);
      if (next) {
        // Ensure key and share once
        let key = e2ee.getKey(dmKeyId);
        if (!key) {
          key = e2ee.generateKey();
          e2ee.saveKey(dmKeyId, key);
        }
  const shareContent = e2ee.buildShareMessage(key!);
  // Auto-send share and an info message without changing input box
  onSendMessage(shareContent);
  onSendMessage(e2ee.buildInfoMessage('enabled'));
        setKeyNotice('Encryption enabled and key shared.');
        refreshE2eeFlags();
      } else {
        // Build and send a disable broadcast so the peer auto-disables too
  const disableContent = e2ee.buildDisableMessage();
  onSendMessage(disableContent);
  onSendMessage(e2ee.buildInfoMessage('disabled'));
        // Locally clear key and flag
        e2ee.deleteKey(dmKeyId);
        refreshE2eeFlags();
        setKeyNotice('Encryption disabled for this conversation.');
      }
      setTimeout(() => setKeyNotice(''), 3000);
    },
    async share(): Promise<void> {
      if (!dmKeyId || selectedConversationType !== 'direct' || !currentUser) return;
      let key = e2ee.getKey(dmKeyId);
      if (!key) {
        key = e2ee.generateKey();
        e2ee.saveKey(dmKeyId, key);
        e2ee.setEnabled(dmKeyId, true);
      }
      // Send as a one-time share message (plaintext, but special prefix)
      const shareContent = e2ee.buildShareMessage(key);
      onSendMessage(shareContent);
      setKeyNotice('Shared encryption key. It will be stored on recipient when they open the chat.');
      setTimeout(() => setKeyNotice(''), 4000);
    },
    export(): void {
      if (!dmKeyId || !currentUser || !selectedConversation) return;
      const data = e2ee.exportKey(activeProfileType, currentUser.user_id, selectedConversation);
      if (!data) { setKeyNotice('No key to export.'); setTimeout(() => setKeyNotice(''), 3000); return; }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `polmatch-e2ee-${data.profileType}-${data.participants[0]}-${data.participants[1]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    import(file: File): void {
      if (!currentUser || !selectedConversation) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(String(reader.result));
          const ok = e2ee.importKey(json, activeProfileType, currentUser.user_id, selectedConversation);
          setKeyNotice(ok ? 'Imported encryption key.' : 'Invalid key file for this conversation.');
        } catch {
          setKeyNotice('Failed to read key file.');
        }
        setTimeout(() => setKeyNotice(''), 3000);
      };
      reader.readAsText(file);
    }
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

  // Compute unread mentions count for this conversation based on last seen timestamp
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser || !currentUser.username) {
      setUnreadMentionsCount(0);
      return;
    }
    const key = getMentionsSeenKey();
    let lastSeen = 0;
    try {
      const v = window.localStorage.getItem(key);
      lastSeen = v ? parseInt(v, 10) : 0;
    } catch {
      lastSeen = 0;
    }
    const count = messages.reduce((acc, m) => {
      const ts = new Date(m.timestamp).getTime();
      if (Number.isNaN(ts) || ts <= lastSeen) return acc;
      const content = (m as PrivateMessage | GroupMessage).content as string | undefined;
      if (!content) return acc;
      return isUserMentioned(content, currentUser.username) ? acc + 1 : acc;
    }, 0);
    setUnreadMentionsCount(count);
  }, [messages, selectedConversation, selectedConversationType, selectedChannel, activeProfileType, currentUser?.username, getMentionsSeenKey, isUserMentioned]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Adjust textarea height whenever value changes (including clear after send)
  useEffect(() => {
    adjustTextareaHeight();
  }, [newMessage, adjustTextareaHeight]);

  // Process incoming E2EE DISABLE messages once per message (side-effects outside render)
  useEffect(() => {
    if (selectedConversationType !== 'direct' || !dmKeyId) return;
    // Find the most recent disable control message in this DM
    const latest = [...messages].reverse().find(m => e2ee.isDisableMessage && e2ee.isDisableMessage((m as PrivateMessage).content));
    if (!latest) return;
    const id = ('_id' in latest && (latest as PrivateMessage)._id) || `${latest.sender_id}:${latest.timestamp}:disable`;
    if (lastProcessedDisableRef.current === id) return;
    // Apply disable locally and refresh UI flags
    e2ee.setEnabled(dmKeyId, false);
    e2ee.deleteKey(dmKeyId);
    refreshE2eeFlags();
    lastProcessedDisableRef.current = id;
  }, [messages, dmKeyId, selectedConversationType, refreshE2eeFlags]);

  // After receiving a SHARE message, store key and enable only if there's no later disable
  useEffect(() => {
    if (selectedConversationType !== 'direct' || !dmKeyId) return;
    const msgs = [...messages];
    const latestShare = msgs.reverse().find(m => m.sender_id !== currentUser?.user_id && e2ee.isShareMessage((m as PrivateMessage).content));
    if (!latestShare) return;
    const shareId = ('_id' in latestShare && (latestShare as PrivateMessage)._id) || `${latestShare.sender_id}:${latestShare.timestamp}:share`;
    if (lastProcessedShareRef.current === shareId) return;
    // Guard: if there's a later disable message than this share, do not auto-enable
    const shareTs = new Date(latestShare.timestamp).getTime();
    const latestDisableTs = messages
      .filter(m => e2ee.isDisableMessage && e2ee.isDisableMessage((m as PrivateMessage).content))
      .reduce((max, m) => Math.max(max, new Date(m.timestamp).getTime()), 0);
    if (latestDisableTs && latestDisableTs >= shareTs) {
      lastProcessedShareRef.current = shareId; // mark processed to avoid loops
      return;
    }
    // Parse key and store+enable if needed
    const key = e2ee.parseShareMessage((latestShare as PrivateMessage).content);
    if (key) {
      const existing = e2ee.getKey(dmKeyId);
      if (!existing || existing !== key) {
        e2ee.saveKey(dmKeyId, key);
      }
      e2ee.setEnabled(dmKeyId, true);
      refreshE2eeFlags();
    }
    lastProcessedShareRef.current = shareId;
  }, [messages, dmKeyId, selectedConversationType, currentUser?.user_id, refreshE2eeFlags]);

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
        {/* Left: avatar + title */}
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          {/* Mobile Toggle Buttons */}
          {isMobile && (
            <div className="flex items-center space-x-3">
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
          {!isMobile && isConversationsSidebarHidden && (
            <button
              onClick={() => setIsConversationsSidebarHidden(false)}
              className={`p-2 ${theme === 'dark' ? 'bg-black text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-black' : 'bg-white text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white'} border rounded-none transition-all shadow-lg font-mono uppercase tracking-wider`}
              title="SHOW CONVERSATIONS"
            >
              <FontAwesomeIcon icon={faEnvelope} />
            </button>
          )}
          {/* Conversation avatar or icon */}
          {selectedConversationData?.type === 'direct' && selectedConversationData.user_id ? (
            <div className={`border-2 ${theme === 'dark' ? 'border-white' : 'border-black'} rounded-none p-1 shadow-lg relative`}>
              <ProfileAvatar userId={selectedConversationData.user_id} size={32} />
              {getUserStatus && (() => {
                const userStatus = getUserStatus(selectedConversationData.user_id);
                return userStatus ? (
                  <div className="absolute -bottom-1 -right-1">
                    <StatusIndicator status={userStatus.status} size="small" inline className="border-2 border-black" />
                  </div>
                ) : null;
              })()}
            </div>
          ) : (
            <div className={`w-8 h-8 ${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border-2 rounded-none flex items-center justify-center shadow-lg`}>
              <FontAwesomeIcon icon={selectedConversationType === 'group' ? faHashtag : faUsers} className={`${theme === 'dark' ? 'text-white' : 'text-black'} text-sm`} />
            </div>
          )}
          {/* Title + status */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-lg font-mono uppercase tracking-wider truncate" title={selectedConversationData?.name || 'Unknown Contact'}>
                <span className="inline-block truncate max-w-[16rem] align-bottom">{selectedConversationData?.name || 'Unknown Contact'}</span>
                {selectedConversationType === 'group' && selectedChannel && groupChannels.length > 0 && (
                  <>
                    <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mx-2`}>/</span>
                    <span className={`${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} inline-block align-bottom truncate max-w-[12rem]`}>
                      #{groupChannels.find(ch => ch.channel_id === selectedChannel)?.name || 'general'}
                    </span>
                  </>
                )}
              </h2>
              {selectedConversationType === 'direct' && (
                <div className="relative inline-block shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowKeyMenu(v => !v)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs border rounded-none shadow ${e2eeEnabled ? (theme === 'dark' ? 'border-green-400 text-green-400' : 'border-green-600 text-green-600') : (theme === 'dark' ? 'border-yellow-400 text-yellow-400' : 'border-yellow-600 text-yellow-600')} cursor-pointer`}
                    title={e2eeEnabled ? 'End-to-end encryption is ON for this DM' : 'Encryption is OFF for this DM'}
                    aria-haspopup="menu"
                    aria-expanded={showKeyMenu}
                  >
                    <FontAwesomeIcon icon={e2eeEnabled ? faLock : faLockOpen} />
                  </button>
                  {showKeyMenu && (
                    <div className={`absolute left-0 top-full mt-2 z-50 w-64 ${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border rounded-none shadow-2xl p-2`} onMouseLeave={() => setShowKeyMenu(false)}>
                      <button className={`w-full text-left px-3 py-2 hover:bg-white/10 ${theme === 'dark' ? 'text-white' : 'text-black'}`} onClick={() => { e2eeActions.toggle(); setShowKeyMenu(false); }}>
                        {e2eeActions.enabled() ? 'Disable encryption' : 'Enable encryption'}
                      </button>
                      <button className={`w-full text-left px-3 py-2 hover:bg-white/10 ${theme === 'dark' ? 'text-white' : 'text-black'}`} onClick={() => { void e2eeActions.share(); setShowKeyMenu(false); }}>
                        Share key (one-time)
                      </button>
                      <button className={`w-full text-left px-3 py-2 hover:bg-white/10 ${theme === 'dark' ? 'text-white' : 'text-black'}`} onClick={() => { e2eeActions.export(); setShowKeyMenu(false); }}>
                        Export key
                      </button>
                      <label className={`block w-full text-left px-3 py-2 hover:bg-white/10 ${theme === 'dark' ? 'text-white' : 'text-black'} cursor-pointer`} title="Import key JSON">
                        Import key
                        <input type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) e2eeActions.import(f); setShowKeyMenu(false); }} />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedConversationType === 'direct' && selectedConversationData?.user_id && getUserStatus && (() => {
              const userStatus = getUserStatus(selectedConversationData.user_id);
              return userStatus ? (
                <StatusIndicator status={userStatus.status} size="small" showLabel customMessage={userStatus.custom_message} />
              ) : null;
            })()}
            {selectedConversationData?.members_count && (
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} font-mono`}>
                {selectedConversationData.members_count} members
              </p>
            )}
          </div>
        </div>
        {/* Right: actions */}
  <div className="flex items-center space-x-3 relative shrink-0">
          {/* Group actions (desktop) */}
          {selectedConversationType === 'group' && !isMobile && (
            <>
              <button
                onClick={() => setShowPollModal(true)}
                className={`p-2 ${theme === 'dark' ? 'bg-black text-white border-white hover:bg-white hover:text-black' : 'bg-white text-black border-black hover:bg-black hover:text-white'} border rounded-none transition-all shadow-lg font-mono`}
                title="Create Poll"
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
            </>
          )}
          {/* Mobile group kebab */}
          {selectedConversationType === 'group' && isMobile && (
            <>
              <button
                type="button"
                aria-label="Menu"
                onClick={() => setIsActionsMenuOpen(v => !v)}
                className={`p-2 ${theme === 'dark' ? 'bg-black text-white border-white hover:bg-white hover:text-black' : 'bg-white text-black border-black hover:bg-black hover:text-white'} border rounded-none transition-all shadow-lg font-mono`}
                title="Menu"
              >
                <FontAwesomeIcon icon={faEllipsisVertical} className="w-5 h-5 shrink-0" />
              </button>
              {isActionsMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsActionsMenuOpen(false)} />
                  <div className={`absolute right-0 top-full mt-2 z-50 w-56 ${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border rounded-none shadow-2xl`}>
                    <button className={`w-full text-left px-3 py-2 hover:bg-white/10 ${theme === 'dark' ? 'text-white' : 'text-black'}`} onClick={() => { onMembersClick(); setIsActionsMenuOpen(false); }}>
                      👥 Members
                    </button>
                    <button className={`w-full text-left px-3 py-2 hover:bg-white/10 ${theme === 'dark' ? 'text-white' : 'text-black'}`} onClick={() => { setShowPollModal(true); setIsActionsMenuOpen(false); }}>
                      📊 Create Poll
                    </button>
                    <button className={`w-full text-left px-3 py-2 hover:bg-white/10 ${theme === 'dark' ? 'text-white' : 'text-black'}`} onClick={() => {
                      if (onPinnedMessagesClick) onPinnedMessagesClick();
                      setIsActionsMenuOpen(false);
                    }}>
                      📌 Pinned Messages
                    </button>
                    <button className={`w-full px-3 py-2 hover:bg-white/10 flex items-center justify-between ${theme === 'dark' ? 'text-white' : 'text-black'}`} onClick={() => { onInvitationsClick(); setIsActionsMenuOpen(false); }} title="Invitations">
                      <span>🔔 Invitations</span>
                      {invitationsCount > 0 && (
                        <span className="ml-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center border border-white">
                          {invitationsCount}
                        </span>
                      )}
                    </button>
                    {canManageMembers && (
                      <>
                        <button className={`w-full text-left px-3 py-2 hover:bg-white/10 ${theme === 'dark' ? 'text-white' : 'text-black'}`} onClick={() => { onInviteClick(); setIsActionsMenuOpen(false); }}>
                          ➕ Invite User
                        </button>
                        <button className={`w-full text-left px-3 py-2 hover:bg-white/10 ${theme === 'dark' ? 'text-white' : 'text-black'}`} onClick={() => { onBannedUsersClick(); setIsActionsMenuOpen(false); }}>
                          🚫 Banned Users
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          )}
          {/* Direct Message Actions */}
          {selectedConversationType === 'direct' && selectedConversationData?.user_id && (
            <button
              onClick={startVoiceCall}
              className={`p-2 ${theme === 'dark' ? 'bg-black text-green-400 border-green-400 hover:bg-green-400 hover:text-black' : 'bg-white text-green-600 border-green-600 hover:bg-green-600 hover:text-white'} border rounded-none transition-all shadow-lg font-mono`}
              title="Start Voice Call"
            >
              <FontAwesomeIcon icon={faPhone} />
            </button>
          )}
          {/* Global: Invitations (hidden on mobile in group chats; available via kebab) */}
          {!(selectedConversationType === 'group' && isMobile) && (
            <button
              onClick={onInvitationsClick}
              className={`relative p-2 ${theme === 'dark' ? 'bg-black text-yellow-400 border-yellow-400 hover:bg-yellow-400 hover:text-black' : 'bg-white text-yellow-600 border-yellow-600 hover:bg-yellow-600 hover:text-white'} border rounded-none transition-all shadow-lg font-mono`}
              title="Invitations"
            >
              <FontAwesomeIcon icon={faBell} />
              {invitationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center border border-white">
                  {invitationsCount}
                </span>
              )}
            </button>
          )}
          {/* Global: Settings */}
          <button
            onClick={() => { if (typeof window !== 'undefined') window.location.href = '/profile'; }}
            className={`p-2 ${theme === 'dark' ? 'bg-black text-gray-300 border-gray-300 hover:bg-gray-300 hover:text-black' : 'bg-white text-gray-700 border-gray-700 hover:bg-gray-700 hover:text-white'} border rounded-none transition-all shadow-lg font-mono`}
            title="Settings"
          >
            <FontAwesomeIcon icon={faCog} />
          </button>
        </div>
      </div>

      {/* Small transient notice area for key operations */}
      {keyNotice && (
        <div className={`px-4 py-2 text-center text-xs ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>{keyNotice}</div>
      )}

      {/* Encryption OFF warning for DMs when a key exists but is disabled */}
      {selectedConversationType === 'direct' && hasDmKey && !e2eeEnabled && (
        <div className={`mx-4 mt-2 mb-0 border-2 ${theme === 'dark' ? 'border-yellow-400 bg-black' : 'border-yellow-600 bg-white'} rounded-none p-2 shadow-lg`}> 
          <div className={`${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'} text-xs font-mono uppercase tracking-widest flex items-center gap-2`}>
            <FontAwesomeIcon icon={faLockOpen} /> Encryption is OFF for this conversation. Messages will send in plaintext.
          </div>
        </div>
      )}

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
                  <span className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-white'} font-mono uppercase tracking-wide truncate max-w-[14rem]`}>
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
                  <span className="text-sm truncate max-w-[12rem]">{channel.name}</span>
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
      <div ref={messagesContainerRef} className={`flex-1 overflow-y-auto p-4 space-y-4 ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}
        onScroll={() => {
          // Optional: clear when the user interacts/scrolls this conversation
          if (unreadMentionsCount > 0) {
            markMentionsSeen();
          }
        }}
      >
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

            // Skip rendering of reaction control messages
            if (reactions.isReactionControl((message as PrivateMessage | GroupMessage).content as string)) {
              return null;
            }

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
                      <div className="flex items-center space-x-2 min-w-0">
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
                            <span
                              className={`text-sm font-mono uppercase tracking-wide ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} truncate max-w-full`}
                              title={displayName}
                            >
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
                    className={`p-4 rounded-none border-2 shadow-lg font-mono break-words group ${
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
                      // E2EE: if DM and content is an encrypted envelope, attempt local decrypt for display
                      if (selectedConversationType === 'direct' && dmKeyId) {
                        // One-time key share handling
                        const shared = e2ee.isShareMessage((message as PrivateMessage).content);
                        if (shared && !isCurrentUser) {
                          return (
                            <div className={`text-xs ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                              Encryption key received and saved.
                            </div>
                          );
                        }
                        // Handle disable broadcast from peer
                        if (!isCurrentUser && e2ee.isDisableMessage((message as PrivateMessage).content)) {
                          return (
                            <div className={`text-xs ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
                              Encryption disabled by other user.
                            </div>
                          );
                        }
                        // If sender is current user and this is a share payload, avoid showing raw share text
                        if (shared && isCurrentUser) {
                          return (
                            <div className={`text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                              Encryption key shared.
                            </div>
                          );
                        }
                        // If sender is current user and this is a disable payload, show a local notice
                        if (isCurrentUser && e2ee.isDisableMessage((message as PrivateMessage).content)) {
                          return (
                            <div className={`text-xs ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-700'}`}>
                              Encryption disabled.
                            </div>
                          );
                        }
                        // Handle E2EE info messages (enabled/disabled)
                        const info = e2ee.isInfoMessage((message as PrivateMessage).content)
                          ? e2ee.parseInfoMessage((message as PrivateMessage).content)
                          : null;
                        if (info) {
                          return (
                            <div className={`text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                              {info === 'enabled' ? 'Encryption enabled.' : 'Encryption disabled.'}
                            </div>
                          );
                        }
                        // Regular encrypted content
                        const dec = e2ee.decryptIfEnvelope(dmKeyId, (message as PrivateMessage).content);
                        if (!dec.ok) {
                          return (
                            <div className={`italic ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{dec.text}</div>
                          );
                        }
                        groupMessage.content = dec.text as string;
                      }
                      
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
                            <div className="flex items-start gap-2">
                              {/* Lock badge per-message when decrypted and encryption enabled */}
          {selectedConversationType === 'direct' && e2eeEnabled && e2ee.isEnvelope((message as PrivateMessage).content) && (
                                <span className={`mt-0.5 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 border rounded-none ${theme === 'dark' ? 'border-green-400 text-green-400' : 'border-green-600 text-green-600'}`} title="Decrypted locally">
                                  <FontAwesomeIcon icon={faLock} />
                                </span>
                              )}
                              <div className="flex-1">
                                <MessageContent 
                                  content={groupMessage.content} 
                                  isOwnMessage={isCurrentUser}
                                  users={users}
                                  currentUser={currentUser}
                                />
                                {/* Reactions bar */}
                                {(() => {
                                  const getId = (): string | null => {
                                    const pm = message as PrivateMessage;
                                    const gm = message as GroupMessage;
                                    if (pm._id) return pm._id;
                                    if (gm.message_id) return gm.message_id;
                                    return null;
                                  };
                                  const mid = getId();
                                  if (!mid) return null;
                                  const reacts = reactionsState?.[mid] || {};
                                  const entries = Object.entries(reacts);
                                  const hasAny = entries.length > 0;
                                  return (
                                    <div className="mt-2">
                                      {hasAny && (
                                        <div className={`inline-flex flex-wrap gap-1 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                                          {entries.map(([emoji, usersArr]) => {
                                            const count = usersArr.length;
                                            const mine = currentUser ? usersArr.includes(currentUser.user_id) : false;
                                            return (
                                              <button
                                                key={`${mid}-${emoji}`}
                                                onClick={() => onToggleReaction?.(mid, emoji)}
                                                className={`text-xs px-2 py-0.5 border rounded-none shadow ${mine ? (theme === 'dark' ? 'border-blue-400' : 'border-blue-600') : (theme === 'dark' ? 'border-gray-500' : 'border-gray-500')}`}
                                                title={`${count} reaction${count !== 1 ? 's' : ''}`}
                                              >
                                                <span className="mr-1">{emoji}</span>
                                                <span className="opacity-80">{count}</span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                      <div className={`${openReactionsFor === mid ? 'inline-block' : 'hidden group-hover:inline-block'} ml-1 relative`}>
                                        <button
                                          type="button"
                                          onClick={() => setOpenReactionsFor(prev => prev === mid ? null : mid)}
                                          className={`text-xs px-2 py-0.5 border rounded-none shadow ${theme === 'dark' ? 'border-white text-white hover:bg-white/10' : 'border-black text-black hover:bg-black/10'}`}
                                          title="Add reaction"
                                        >
                                          🙂
                                        </button>
                                        {openReactionsFor === mid && (
                                          <div className={`absolute z-50 mt-1 p-2 ${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border rounded-none shadow-2xl`}
                                            onMouseLeave={() => setOpenReactionsFor(null)}
                                          >
                                            <div className="flex gap-1">
                                              {quickEmojis.map(em => (
                                                <button
                                                  key={em}
                                                  onClick={() => { onToggleReaction?.(mid, em); setOpenReactionsFor(null); }}
                                                  className={`text-base px-2 py-1 border rounded-none ${theme === 'dark' ? 'border-white hover:bg-white/10' : 'border-black hover:bg-black/10'}`}
                                                >
                                                  {em}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
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
        {/* Mention badge like Discord */}
        {unreadMentionsCount > 0 && (
          <div className="flex items-center justify-end mb-2">
            <div className="bg-red-600 text-white text-xs font-mono rounded-full w-6 h-6 flex items-center justify-center shadow-lg border border-white">
              {unreadMentionsCount}
            </div>
          </div>
        )}
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
        <div className="flex space-x-3 relative">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => {
                const val = e.target.value;
                setNewMessage(val);
                onTyping(); // Emit typing indicator when user types
                handleMention(val, e.target.selectionStart || val.length);
                // Auto-resize as the user types
                adjustTextareaHeight();
              }}
              onFocus={() => {
                if (unreadMentionsCount > 0) markMentionsSeen();
              }}
              onKeyDown={(e) => {
                handleMentionKeyDown(e);
                // Don't interfere with existing key handlers if no mentions shown
                if (!showMentionSuggestions) {
                  handleKeyPress(e);
                }
              }}
              placeholder={`Message ${selectedConversationData?.name || 'Unknown'}...`}
              className={`w-full ${theme === 'dark' ? 'bg-black text-white border-white focus:border-blue-400' : 'bg-white text-black border-black focus:border-blue-600'} border-2 rounded-none p-3 resize-none focus:outline-none font-mono shadow-lg`}
              rows={1}
              aria-multiline="true"
              style={{ minHeight: '48px', maxHeight: '240px' }}
            />
            
            {/* Mention suggestions dropdown */}
            {showMentionSuggestions && (
              <div className={`absolute bottom-full left-0 mb-2 w-full max-h-40 overflow-auto ${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border-2 rounded-none shadow-lg z-50 font-mono`}>
                {mentionSuggestions.map((user, index) => (
                  <div
                    key={user.user_id}
                    className={`px-3 py-2 cursor-pointer transition-colors border-b border-gray-600 last:border-b-0 ${
                      index === selectedMentionIndex
                        ? (theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-200 text-black')
                        : (theme === 'dark' ? 'hover:bg-white/20 text-white' : 'hover:bg-black/20 text-black')
                    }`}
                    onMouseEnter={() => setSelectedMentionIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent textarea blur
                      insertMention(user);
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <ProfileAvatar userId={user.user_id} size={20} />
                      <span className="font-bold">@{user.username}</span>
                      {user.display_name && (
                        <span className={`text-sm ${
                          index === selectedMentionIndex
                            ? (theme === 'dark' ? 'text-gray-200' : 'text-gray-800')
                            : (theme === 'dark' ? 'text-gray-400' : 'text-gray-600')
                        }`}>
                          ({user.display_name})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onSendMessage()}
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