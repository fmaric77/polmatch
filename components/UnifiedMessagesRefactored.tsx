import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useConversations } from './hooks/useConversations';
import { useProfileConversations, useProfileMessages } from './hooks/useProfileMessaging';
import type { ProfileMessage } from './hooks/useProfileMessaging';
import { useGroupManagement } from './hooks/useGroupManagement';
import { useModalStates } from './hooks/useModalStates';
import { useMessages } from './hooks/useMessages';
import { useUserStatus, UserStatus } from './hooks/useUserStatus';
import { VoiceCallEventData } from './hooks/useWebSocket';
import type { NewMessageData, NewConversationData } from './hooks/useWebSocket';
import { useTypingIndicator, TypingData } from './hooks/useTypingIndicator';
import { useSSE } from './providers/SSEProvider';
import { useTheme } from './ThemeProvider';
import { NotificationsProvider, useNotifications } from './providers/NotificationsProvider';
import ConversationsList from './ConversationsList';
import ChatArea from './ChatArea';
import CreateGroupModal from './modals/CreateGroupModal';
import NewDMModal from './modals/NewDMModal';
import MembersModal from './modals/MembersModal';
import BannedUsersModal from './modals/BannedUsersModal';
import InviteModal from './modals/InviteModal';
import InvitationsModal from './modals/InvitationsModal';
import CreateChannelModal from './modals/CreateChannelModal';
import PinnedMessagesModal from './modals/PinnedMessagesModal';
import ContextMenu from './modals/ContextMenu';
import { useCSRFToken } from './hooks/useCSRFToken';
import e2ee from '../lib/e2ee';

// Dynamically import VoiceCall to prevent SSR issues
const VoiceCall = dynamic(() => import('./VoiceCall'), {
  ssr: false,
  loading: () => null
});

// Import the type separately for TypeScript
import type { VoiceCallRef } from './VoiceCall';

type ProfileType = 'basic' | 'love' | 'business';

interface PrivateMessage {
  _id?: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  timestamp: string;
  read: boolean;
  attachments: string[];
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
  is_pinned?: boolean;
  pinned_at?: string;
  pinned_by?: string;
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
  reply_to?: {
    message_id: string;
    content: string;
    sender_name: string;
  };
}

// Type for group message SSE payload
interface GroupMessageSSE {
  message_id: string;
  group_id: string;
  channel_id?: string;
  sender_id: string;
  content: string;
  timestamp: string;
  attachments?: string[];
  sender_username?: string;
  sender_display_name?: string;
  total_members?: number;
  read_count?: number;
  read_by_others?: boolean;
  reply_to?: {
    message_id: string;
    content: string;
    sender_name: string;
  };
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

// Internal component to access notifications hook and main logic
const UnifiedMessagesInner: React.FC = () => {
  const { protectedFetch } = useCSRFToken();
  const { theme } = useTheme();
  
  // Core state - currentUser is now provided by SSEProvider
  const [loading, setLoading] = useState(true);
  
  // Profile separation state
  const [activeProfileType, setActiveProfileType] = useState<ProfileType>('basic');
  
  // Navigation state - unified messaging only
  const [selectedCategory, setSelectedCategory] = useState<'direct' | 'groups' | 'unified'>('unified');
  const [selectedConversation, setSelectedConversation] = useState<string>('');
  const [selectedConversationType, setSelectedConversationType] = useState<'direct' | 'group'>('direct');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  // Display names cache for direct messages (user_id -> display name)
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});

  // Auto-select state (for URL parameters)
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // Mobile state
  const [isMobile, setIsMobile] = useState(false);
  const [isConversationsSidebarHidden, setIsConversationsSidebarHidden] = useState(false);

  // Message input state
  const [newMessage, setNewMessage] = useState('');
  // Local unread counters
  const [unreadDMCounts, setUnreadDMCounts] = useState<Record<string, number>>({});
  const [unreadGroupCounts, setUnreadGroupCounts] = useState<Record<string, number>>({});
  // Track unread @mention counts per group for red dot indicator
  const [unreadGroupMentions, setUnreadGroupMentions] = useState<Record<string, number>>({});

  // Reply state
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; sender_name: string } | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'conversation' | 'message' | 'member' | 'channel';
    id: string;
    extra?: unknown;
  } | null>(null);

  // SSE connection for real-time messaging
  const { 
    isConnected, 
    connectionError, 
    sessionToken, 
    currentUser, 
    refreshConnection,
    setMessageHandler,
    setConversationHandler,
    setConnectionHandler,
    setTypingStartHandler,
    setTypingStopHandler,
    setIncomingCallHandler,
    setCallStatusUpdateHandler,
    setStatusChangeHandler
  } = useSSE();

  // User status management
  const userStatus = useUserStatus(currentUser);

  // Custom hooks that depend on currentUser
  const conversations = useConversations(currentUser, activeProfileType, 'all'); // Always fetch all for unified view
  const profileConversations = useProfileConversations(activeProfileType);
  const profileMessages = useProfileMessages(activeProfileType);
  const groupManagement = useGroupManagement(currentUser, activeProfileType);
  const modals = useModalStates();
  const messages = useMessages(
    currentUser,
    selectedConversation,
    selectedConversationType,
    selectedChannel,
    groupManagement.groupChannels,
    activeProfileType
  );

  // Voice call state management using SSE
  const [incomingCalls, setIncomingCalls] = useState<{
    incomingCalls: VoiceCallEventData[];
    declineCall: (callId: string) => void;
    endCall: (callId: string) => void;
    initiateCall: (otherUser: { user_id: string; username: string; display_name?: string }) => void;
  }>({
    incomingCalls: [],
    declineCall: () => {},
    endCall: () => {},
    initiateCall: () => {},
  });

  // Voice call refs and state management
  const voiceCallRef = useRef<VoiceCallRef>(null);
  const callSoundRef = useRef<HTMLAudioElement | null>(null);
  const isCallSoundPlayingRef = useRef<boolean>(false);
  // Audio autoplay policy handling
  const audioUnlockedRef = useRef<boolean>(false);
  const pendingRingtoneRef = useRef<boolean>(false);
  // Track outgoing call active state in a ref to avoid stale closures in SSE handlers
  const outgoingCallIsActiveRef = useRef<boolean>(false);
  // Latch acceptance if it arrives before the VoiceCall ref is ready
  const pendingOutgoingAcceptRef = useRef<boolean>(false);
  const [outgoingCall, setOutgoingCall] = useState<{
    isActive: boolean;
    otherUser: { user_id: string; username: string; display_name?: string } | null;
    callId: string | null;
  }>({
    isActive: false,
    otherUser: null,
    callId: null,
  }  );

  // Typing indicator hook (after currentUser is available from SSE)
  const typingIndicator = useTypingIndicator({
    currentUser,
    selectedConversation,
    selectedConversationType,
    selectedChannel,
    sessionToken
  });

  // Keep the ref in sync with state so SSE handlers always see latest value
  useEffect(() => {
    outgoingCallIsActiveRef.current = outgoingCall.isActive;
  }, [outgoingCall.isActive]);

  // If acceptance arrived before the outgoing VoiceCall ref was ready, retry until it's mounted then join
  useEffect(() => {
    if (outgoingCall.isActive && pendingOutgoingAcceptRef.current) {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (voiceCallRef.current && pendingOutgoingAcceptRef.current) {
          console.log('ℹ️ Consuming deferred call acceptance after modal mount');
          voiceCallRef.current.handleCallAccepted();
          pendingOutgoingAcceptRef.current = false;
          clearInterval(timer);
        } else if (attempts > 20) {
          clearInterval(timer);
        }
      }, 150);
      return () => clearInterval(timer);
    }
  }, [outgoingCall.isActive]);

  // Debug session token changes
  useEffect(() => {
    console.log('🔧 Session token changed:', sessionToken ? sessionToken.substring(0, 10) + '...' : 'null');
  }, [sessionToken]);

  // Notifications
  const { notify, playBeep } = useNotifications();

  // Register SSE handlers when component mounts
  useEffect(() => {
    // Setup call management functions
    const declineCall = async (callId: string): Promise<void> => {
      try {
        console.log('Declining call:', callId);
        const response = await protectedFetch('/api/voice-calls', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            call_id: callId, 
            status: 'declined' 
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to decline call: ${response.status}`);
        }
        
        // Remove from local state immediately for UI responsiveness
        setIncomingCalls(prev => ({
          ...prev,
          incomingCalls: prev.incomingCalls.filter(call => call.call_id !== callId)
        }));
      } catch (error) {
        console.error('Error declining call:', error);
      }
    };

    const endCall = async (callId: string): Promise<void> => {
      try {
        console.log('Ending call:', callId);
        const response = await protectedFetch('/api/voice-calls', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            call_id: callId, 
            status: 'ended' 
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to end call: ${response.status}`);
        }
        
        // Remove from local state immediately for UI responsiveness
        setIncomingCalls(prev => ({
          ...prev,
          incomingCalls: prev.incomingCalls.filter(call => call.call_id !== callId)
        }));
      } catch (error) {
        console.error('Error ending call:', error);
      }
    };

  const initiateCall = (otherUser: { user_id: string; username: string; display_name?: string }): void => {
      // Prevent starting multiple calls
      if (outgoingCall.isActive) {
        console.log('❌ Cannot initiate call - already have an active outgoing call');
        return;
      }
      
      console.log('📞 Initiating call to:', otherUser.username);
      setOutgoingCall({
        isActive: true,
        otherUser,
        callId: null // Will be set when the call notification is sent
      });
    };
    
    // Set call management functions
    setIncomingCalls(prev => ({
      ...prev,
      declineCall,
      endCall,
      initiateCall
    }));
  }, []);

  // Initialize call sound
  useEffect(() => {
    if (typeof window !== 'undefined') {
      callSoundRef.current = new Audio('/sounds/call.mp3');
      callSoundRef.current.loop = true;
      callSoundRef.current.volume = 0.7;
    }
    
    return () => {
      // Cleanup audio when component unmounts
      if (callSoundRef.current) {
        callSoundRef.current.pause();
        callSoundRef.current = null;
      }
    };
  }, []);

  // Unlock audio on first user interaction to comply with autoplay policies
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let removed = false;
    const tryUnlock = async (): Promise<void> => {
      if (audioUnlockedRef.current) return;
      try {
        if (callSoundRef.current) {
          // Attempt a muted play to unlock
          callSoundRef.current.muted = true;
          await callSoundRef.current.play().catch(() => {});
          callSoundRef.current.pause();
          callSoundRef.current.currentTime = 0;
          callSoundRef.current.muted = false;
        }
        audioUnlockedRef.current = true;
        // If a ringtone was pending, play it now
        if (pendingRingtoneRef.current) {
          pendingRingtoneRef.current = false;
          setTimeout(() => {
            // best-effort; ignore errors here
            playCallSound();
          }, 0);
        }
        // Remove listeners after unlock
        window.removeEventListener('click', tryUnlock);
        window.removeEventListener('touchstart', tryUnlock);
        window.removeEventListener('keydown', tryUnlock);
        removed = true;
      } catch {
        // ignore; will retry on next interaction
      }
    };
    window.addEventListener('click', tryUnlock, { once: false });
    window.addEventListener('touchstart', tryUnlock, { once: false });
    window.addEventListener('keydown', tryUnlock, { once: false });
    return () => {
      if (!removed) {
        window.removeEventListener('click', tryUnlock);
        window.removeEventListener('touchstart', tryUnlock);
        window.removeEventListener('keydown', tryUnlock);
      }
    };
  }, []);

  // Function to play call sound
  const playCallSound = useCallback(() => {
    if (!audioUnlockedRef.current) {
      // Defer until the user interacts and we unlock audio
      pendingRingtoneRef.current = true;
      return;
    }
    if (callSoundRef.current && !isCallSoundPlayingRef.current) {
      isCallSoundPlayingRef.current = true;
      callSoundRef.current.currentTime = 0;
      callSoundRef.current.play().catch(error => {
        console.error('Failed to play call sound:', error);
        isCallSoundPlayingRef.current = false;
      });
    }
  }, []);

  // Function to stop call sound
  const stopCallSound = useCallback(() => {
    if (callSoundRef.current && isCallSoundPlayingRef.current) {
      callSoundRef.current.pause();
      callSoundRef.current.currentTime = 0;
      isCallSoundPlayingRef.current = false;
    }
  }, []);

  // Stop call sound when there are no incoming calls
  useEffect(() => {
    if (incomingCalls.incomingCalls.length === 0) {
      stopCallSound();
    }
  }, [incomingCalls.incomingCalls.length, stopCallSound]);

  // Register SSE handlers when component mounts
  useEffect(() => {
    // Register message handler
    setMessageHandler((data: NewMessageData) => {
  console.log('Received new message via SSE:', data);

      // Global E2EE disable-broadcast handling for direct messages
      try {
        const isGroup = (data as unknown as { group_id?: string }).group_id != null;
        if (!isGroup && currentUser && typeof data.content === 'string' && e2ee.isDisableMessage && e2ee.isDisableMessage(data.content)) {
          const otherId = data.sender_id === currentUser.user_id ? (data.receiver_id || '') : data.sender_id;
          if (otherId) {
            const keyId = e2ee.getKeyId(activeProfileType, currentUser.user_id, otherId);
            e2ee.setEnabled(keyId, false);
            e2ee.deleteKey(keyId);
            // If this DM is currently open in profile view, add a small local notice
            const dmIsOpen = selectedConversationType === 'direct' && selectedConversation === otherId && (selectedCategory === 'direct' || selectedCategory === 'unified');
            if (dmIsOpen) {
              const note: ProfileMessage = {
                _id: data.message_id,
                sender_id: data.sender_id,
                receiver_id: data.receiver_id,
                content: 'Encryption disabled by other user.',
                timestamp: data.timestamp,
                read: false,
                attachments: [],
                profile_type: activeProfileType,
              };
              profileMessages.setMessages(prev => {
                const exists = prev.some(m => m._id === note._id);
                if (exists) return prev;
                const updated = [...prev, note];
                return updated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
              });
            }
          }
        }
      } catch {
        // ignore
      }

      // General notifications for DMs not currently viewed
      try {
        const isGroup = (data as unknown as { group_id?: string }).group_id != null;
        if (!isGroup && currentUser) {
          const isOwn = data.sender_id === currentUser.user_id;
          const otherId = data.sender_id === currentUser.user_id ? (data.receiver_id || '') : data.sender_id;
          const viewingDM = selectedConversationType === 'direct' && selectedConversation === otherId;
          if (!isOwn && otherId && !viewingDM) {
            setUnreadDMCounts(prev => ({ ...prev, [otherId]: (prev[otherId] || 0) + 1 }));
            const display = displayNames[data.sender_id] || 'New Direct Message';
            notify({
              title: display,
              message: data.content,
              type: 'info',
              onClick: () => {
                setSelectedCategory('unified');
                setSelectedConversation(otherId);
                setSelectedConversationType('direct');
              }
            });
            playBeep();
          }
        } else if (isGroup && currentUser) {
          const groupData = data as unknown as GroupMessageSSE;
          // If we're not currently viewing this group/channel, consider notifying/incrementing
          const weAreViewing = selectedConversationType === 'group' && selectedConversation === groupData.group_id &&
            (!selectedChannel || groupData.channel_id === selectedChannel);
          if (!weAreViewing) {
            // Always increment unread for unseen group traffic
            setUnreadGroupCounts(prev => ({ ...prev, [groupData.group_id]: (prev[groupData.group_id] || 0) + 1 }));
            // Only notify/beep when the current user is @mentioned and it's not our own message
            if (groupData.sender_id !== currentUser.user_id) {
              const uname = currentUser.username || '';
              const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const isMentioned = uname ? new RegExp(`@${escapeRegExp(uname)}(\\b|$)`, 'i').test(groupData.content || '') : false;
              if (isMentioned) {
                setUnreadGroupMentions(prev => ({ ...prev, [groupData.group_id]: (prev[groupData.group_id] || 0) + 1 }));
                const group = conversations.conversations.find(c => c.type === 'group' && c.id === groupData.group_id);
                const groupName = group?.name || 'New Group Message';
                notify({
                  title: groupName,
                  message: groupData.content,
                  type: 'info',
                  onClick: () => {
                    setSelectedCategory('unified');
                    setSelectedConversation(groupData.group_id);
                    setSelectedConversationType('group');
                    if (groupData.channel_id) setSelectedChannel(groupData.channel_id);
                  }
                });
                playBeep();
              }
            }
          }
        }
      } catch {
        // ignore
      }
      
      // Handle direct messages - check if we're in profile mode
      if (selectedConversation && selectedConversationType === 'direct' && 
          ((data.sender_id === selectedConversation && data.receiver_id === currentUser?.user_id) ||
           (data.sender_id === currentUser?.user_id && data.receiver_id === selectedConversation))) {
        
        // Always use profile messages for direct messages (both direct and unified views)
        if (selectedCategory === 'direct' || selectedCategory === 'unified') {
          // Add the message directly to profile messages state for instant display
          // Attempt to decrypt envelope immediately for display purposes
          let sseContent = data.content;
          if (selectedConversationType === 'direct' && currentUser && selectedConversation) {
            const keyId = e2ee.getKeyId(activeProfileType, currentUser.user_id, selectedConversation);
            const dec = e2ee.decryptIfEnvelope(keyId, sseContent);
            if (dec.ok) sseContent = dec.text;
          }
          const newProfileMessage: ProfileMessage = {
            _id: data.message_id,
            sender_id: data.sender_id,
            receiver_id: data.receiver_id,
            content: sseContent,
            timestamp: data.timestamp,
            read: false,
            attachments: (data as { attachments?: string[] }).attachments || [],
            profile_type: activeProfileType,
            ...(data.reply_to && { reply_to: data.reply_to })
          };
          
          profileMessages.setMessages(prevMessages => {
            // Only check for ID-based duplicates to allow legitimate duplicate content
            const messageExists = prevMessages.some(msg => {
              // Only check message ID matches - allow same content from same user (legitimate duplicates)
              return (
                msg._id === data.message_id ||
                msg._id === newProfileMessage._id ||
                (msg as { message_id?: string }).message_id === data.message_id
              );
            });
            
            if (messageExists) {
              console.debug('ℹ️ Filtered duplicate message ID (normal SSE + UI sync):', data.message_id);
              return prevMessages;
            }
            
            const updatedMessages = [...prevMessages, newProfileMessage];
            return updatedMessages.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        } else {
          // Use regular message handling for legacy conversations
          const newMessage: PrivateMessage = {
            _id: data.message_id,
            sender_id: data.sender_id,
            receiver_id: data.receiver_id,
            content: data.content,
            timestamp: data.timestamp,
            read: false,
            attachments: (data as { attachments?: string[] }).attachments || [],
            ...(data.reply_to && { reply_to: data.reply_to })
          };
          
          messages.setMessages(prevMessages => {
            console.log('Adding SSE direct message. Current count:', prevMessages.length);
            
            // Only check for ID-based duplicates to allow legitimate duplicate content
            const messageExists = prevMessages.some(msg => {
              const msgId = ('_id' in msg) ? msg._id : ('message_id' in msg) ? (msg as GroupMessage).message_id : null;
              
              // Only check ID matches - allow same content from same user (legitimate duplicates)
              return (
                msgId === newMessage._id || 
                msgId === data.message_id
              );
            });
            
            if (messageExists) {
              console.debug('ℹ️ Filtered duplicate message ID (normal SSE + UI sync):', data.message_id);
              return prevMessages;
            }
            
            console.log('Adding new direct message via SSE:', data.message_id);
            const updatedMessages = [...prevMessages, newMessage];
            return updatedMessages.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });

          // Notification for DMs is handled by the general-case handler above to avoid duplicates.
        }
      }
      
      // Handle group messages
      if (selectedConversation && selectedConversationType === 'group') {
        const groupData = data as unknown as GroupMessageSSE;
        if (
          groupData.group_id === selectedConversation &&
          (!selectedChannel || groupData.channel_id === selectedChannel)
        ) {
          const newMessage: GroupMessage = {
            message_id: groupData.message_id,
            group_id: groupData.group_id,
            channel_id: groupData.channel_id || '',
            sender_id: groupData.sender_id,
            content: groupData.content,
            timestamp: groupData.timestamp,
            attachments: groupData.attachments || [],
            sender_username: groupData.sender_username || 'Unknown',
            sender_display_name: groupData.sender_display_name,
            current_user_read: groupData.sender_id === currentUser?.user_id,
            total_members: groupData.total_members || 0,
            read_count: groupData.read_count || 0,
            read_by_others: groupData.read_by_others || false,
            ...(groupData.reply_to && { reply_to: groupData.reply_to })
          };
          messages.setMessages(prevMessages => {
            console.log('Adding SSE group message. Current count:', prevMessages.length);
            
            // Only check for ID-based duplicates to allow legitimate duplicate content
            const messageExists = prevMessages.some(msg => {
              const msgId = ('_id' in msg) ? (msg as PrivateMessage)._id : ('message_id' in msg) ? (msg as GroupMessage).message_id : null;
              
              // Only check ID matches - allow same content from same user (legitimate duplicates)
              return (
                msgId === newMessage.message_id || 
                msgId === groupData.message_id
              );
            });
            if (messageExists) {
              console.debug('ℹ️ Filtered duplicate message ID (normal SSE + UI sync):', groupData.message_id);
              return prevMessages;
            }
            
            const updatedMessages = [...prevMessages, newMessage];
            return updatedMessages.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });

          // In-app notification for group messages if not currently in the same group/channel
          const weAreViewing = selectedConversationType === 'group' && selectedConversation === groupData.group_id &&
            (!selectedChannel || groupData.channel_id === selectedChannel);
      if (!weAreViewing) {
            const group = conversations.conversations.find(c => c.type === 'group' && c.id === groupData.group_id);
            const groupName = group?.name || 'New Group Message';
            // Only notify/beep if the current user is @mentioned in the message
            const uname = currentUser?.username || '';
            const isMentioned = uname
              ? new RegExp(`(^|\\s|[^\\w])@${uname.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(\\b|[^\\w])`, 'i').test(groupData.content || '')
              : false;
            if (isMentioned) {
              notify({
                title: groupName,
                message: groupData.content,
                type: 'info',
                onClick: () => {
                  setSelectedCategory('unified');
                  setSelectedConversation(groupData.group_id);
                  setSelectedConversationType('group');
                  if (groupData.channel_id) setSelectedChannel(groupData.channel_id);
                }
              });
              playBeep();
        setUnreadGroupMentions(prev => ({ ...prev, [groupData.group_id]: (prev[groupData.group_id] || 0) + 1 }));
            }
            // Always increment unread when not viewing, regardless of mention
            setUnreadGroupCounts(prev => ({ ...prev, [groupData.group_id]: (prev[groupData.group_id] || 0) + 1 }));
          }
        }
      }
      
      // Refresh conversations list to update last message/unread count
      // TODO: Incrementally update conversation last_message instead of full refresh to avoid UI flicker
      // conversations.fetchConversations();
      // profileConversations.fetchConversations();
    });

    // Register conversation handler
    setConversationHandler((data: NewConversationData) => {
      console.log('Received new conversation via SSE:', data);
      
      // If this involves the current user, refresh conversations
      if (currentUser && data.participants.includes(currentUser.user_id)) {
        conversations.fetchConversations();
        profileConversations.fetchConversations();
      }
    });

    // Register connection handler
    setConnectionHandler(() => {
      console.log('SSE connection established successfully');
    });

    // Register typing handlers
    setTypingStartHandler((data: TypingData) => {
      console.log('Received typing start via SSE:', data);
      typingIndicator.handleTypingReceived(data);
    });

    setTypingStopHandler((data: Pick<TypingData, 'user_id' | 'conversation_id' | 'conversation_type' | 'channel_id'>) => {
      console.log('Received typing stop via SSE:', data);
      typingIndicator.handleStoppedTyping(data);
    });

    // Register call handlers
    setIncomingCallHandler((data: VoiceCallEventData) => {
      console.log('Received incoming call via SSE:', data);
      // Only show incoming call if it's for this user
      if (data.recipient_id === currentUser?.user_id && data.status === 'calling') {
        setIncomingCalls(prev => ({
          ...prev,
          incomingCalls: [...prev.incomingCalls, data]
        }));
        
        // Play call sound for incoming call
        playCallSound();
      }
    });

    setCallStatusUpdateHandler((data: VoiceCallEventData) => {
      console.log('Received call status update via SSE:', data);
      
      // Handle outgoing call status updates (for calls we initiated)
      if (data.caller_id === currentUser?.user_id && outgoingCallIsActiveRef.current) {
        if (data.status === 'accepted') {
          console.log('📞 Outgoing call was accepted');
          if (voiceCallRef.current) {
            voiceCallRef.current.handleCallAccepted();
          } else {
            console.log('ℹ️ VoiceCall ref not ready yet, deferring accept handling');
            pendingOutgoingAcceptRef.current = true;
          }
        } else if (data.status === 'declined') {
          console.log('📞 Outgoing call was declined');
          voiceCallRef.current?.handleCallDeclined();
          setOutgoingCall({ isActive: false, otherUser: null, callId: null });
        } else if (data.status === 'ended') {
          console.log('📞 Outgoing call ended by other participant');
          voiceCallRef.current?.handleCallEndedByOther();
          setOutgoingCall({ isActive: false, otherUser: null, callId: null });
        } else if (data.status === 'missed') {
          console.log('📞 Outgoing call was missed/cancelled');
          voiceCallRef.current?.handleCallDeclined(); // Treat missed like declined for outgoing calls
          setOutgoingCall({ isActive: false, otherUser: null, callId: null });
        }
        return;
      }
      
      // Handle call end/missed when we are the recipient
      if (data.recipient_id === currentUser?.user_id && (data.status === 'ended' || data.status === 'missed')) {
        console.log(`📞 Caller ${data.status} the call - checking if we have an active call`);
        
        // Stop the ringing sound if it's playing
        stopCallSound();
        
        // Check if we have an active incoming call that matches this call_id
        const hasActiveCall = incomingCalls.incomingCalls.some(call => call.call_id === data.call_id);
        
        if (hasActiveCall) {
          console.log('📞 Active call found, ending it');
          // If there's an active voice call modal, close it
          if (data.status === 'missed') {
            voiceCallRef.current?.handleCallMissed();
          } else {
            voiceCallRef.current?.handleCallEndedByOther();
          }
        }
        
        // Remove from incoming calls list if it exists there
        setIncomingCalls(prev => ({
          ...prev,
          incomingCalls: prev.incomingCalls.filter(call => call.call_id !== data.call_id)
        }));
        return;
      }
      
      // Handle incoming call status updates
      setIncomingCalls(prev => {
        // Find call in our list
        const existingCallIndex = prev.incomingCalls.findIndex(call => call.call_id === data.call_id);
        
        // If call not found, nothing to do
        if (existingCallIndex === -1) return prev;

        // If call is accepted, stop the ringing sound
        if (data.status === 'accepted') {
          stopCallSound();
        }

        // If call is ended/declined/missed, remove it from our list and stop sound
        if (data.status === 'declined' || data.status === 'ended' || data.status === 'missed') {
          stopCallSound();
          const updatedCalls = [...prev.incomingCalls];
          updatedCalls.splice(existingCallIndex, 1);
          return {
            ...prev,
            incomingCalls: updatedCalls
          };
        }

        // Otherwise update call status
        const updatedCalls = [...prev.incomingCalls];
        updatedCalls[existingCallIndex] = data;
        return {
          ...prev,
          incomingCalls: updatedCalls
        };
      });
    });

    // Register status change handler
    setStatusChangeHandler(userStatus.handleStatusChange);

    // Cleanup handlers when component unmounts
    return () => {
      setMessageHandler(null);
      setConversationHandler(null);
      setConnectionHandler(null);
      setTypingStartHandler(null);
      setTypingStopHandler(null);
      setIncomingCallHandler(null);
      setCallStatusUpdateHandler(null);
      setStatusChangeHandler(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, selectedConversation, selectedConversationType, selectedCategory, activeProfileType, setMessageHandler, setConversationHandler, setConnectionHandler, setTypingStartHandler, setTypingStopHandler, setIncomingCallHandler, setCallStatusUpdateHandler, setStatusChangeHandler]);

  // Ensure SSE reconnection after calls end or any call state changes
  useEffect(() => {
    // If we don't have an outgoing call and no incoming calls, but we have a session token and we're not connected
    if (sessionToken && !isConnected && !outgoingCall && incomingCalls.incomingCalls.length === 0) {
      console.log('🔄 No active calls and SSE disconnected, attempting reconnection...');
      const reconnectTimer = setTimeout(() => {
        refreshConnection();
      }, 2000); // Small delay to avoid rapid reconnections
      
      return () => clearTimeout(reconnectTimer);
    }
  }, [sessionToken, isConnected, outgoingCall, incomingCalls.incomingCalls.length, refreshConnection]);

  // Force reconnection after any call status changes (more aggressive)
  useEffect(() => {
    if (sessionToken && !isConnected) {
      console.log('🔄 SSE disconnected, forcing reconnection attempt...');
      const forceReconnectTimer = setTimeout(() => {
        refreshConnection();
      }, 1000);
      
      return () => clearTimeout(forceReconnectTimer);
    }
  }, [sessionToken, isConnected, refreshConnection]);

  // Debug SSE connection status
  useEffect(() => {
    console.log('🔧 SSE connection status:', { isConnected, connectionError, sessionToken: sessionToken ? 'present' : 'null' });
  }, [isConnected, connectionError, sessionToken]);

  const searchParams = useSearchParams();

  // Session data is now provided by SSEProvider - no need to fetch it here
  
  // Set loading to false when we have currentUser from SSEProvider
  useEffect(() => {
    if (currentUser) {
      setLoading(false);
    }
  }, [currentUser]);

  // Fetch users list
  useEffect(() => {
    if (currentUser) {
      fetch('/api/users/list')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // Users data fetched but not stored since it's unused
          }
        })
        .catch(err => console.error('Failed to fetch users:', err));
    }
  }, [currentUser]);

  // Initialize data when user is loaded - FIXED to prevent infinite loops
  useEffect(() => {
    if (currentUser) {
      conversations.fetchConversations();
      groupManagement.fetchInvitations();
      groupManagement.fetchInvitationSummary(); // Fetch summary of all profile invitations
      profileConversations.fetchConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]); // Only depend on currentUser to prevent infinite loops

  // Fetch profile conversations when profile type changes - for both direct and unified views
  useEffect(() => {
    if (currentUser && (selectedCategory === 'direct' || selectedCategory === 'unified')) {
      console.log('🔄 Fetching profile conversations for category:', selectedCategory, 'profile:', activeProfileType);
      profileConversations.fetchConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileType, currentUser, selectedCategory]);

  // Refresh invitations when profile type changes (for all categories)
  useEffect(() => {
    if (currentUser) {
      console.log('🔔 Profile type changed, refreshing invitations for:', activeProfileType);
      groupManagement.fetchInvitations();
      groupManagement.fetchInvitationSummary(); // Also refresh the summary
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileType, currentUser]);

  // Refresh groups and invitations when profile type changes (unified view)
  useEffect(() => {
    if (selectedCategory === 'unified') {
      console.log('🔧 Profile type changed in unified view, refreshing groups and invitations for profile:', activeProfileType);
      
      // Refresh groups and invitations for the new profile type
      conversations.fetchConversations();
      groupManagement.fetchInvitations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileType, selectedCategory]);

  // Log when category changes
  useEffect(() => {
    console.log('📂 CATEGORY CHANGED to:', selectedCategory);
  }, [selectedCategory]);

  // Clear URL parameters after auto-select to prevent forced navigation
  useEffect(() => {
    if (hasAutoSelected && typeof window !== 'undefined') {
      // Use router.replace to update URL without page reload and without adding to history
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has('user') || currentUrl.searchParams.has('profile')) {
        currentUrl.searchParams.delete('user');
        currentUrl.searchParams.delete('profile');
        const newUrl = currentUrl.pathname + (currentUrl.search ? currentUrl.search : '');
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [hasAutoSelected]);

  // Clear and refetch messages when profile type changes for selected conversation
  useEffect(() => {
    if (currentUser && selectedConversation && selectedConversationType === 'direct' && !profileMessages.loading) {
      // Fetch messages for the new profile type (clearing is handled by the hook)
      console.log('🔄 Profile type changed, refetching direct messages for:', selectedConversation, 'profile:', activeProfileType);
      profileMessages.fetchMessages(selectedConversation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfileType, selectedConversation, selectedConversationType]); // Removed selectedCategory dependency

  // Handle conversation selection
  const selectConversation = useCallback((conversation: Conversation) => {
    messages.setContextSwitchLoading(conversation.type === 'group');
    
    setSelectedConversation(conversation.id);
    setSelectedConversationType(conversation.type);
    setReplyTo(null); // Clear any active reply when switching conversations
    // Reset unread count for opened conversation
    if (conversation.type === 'direct') {
      setUnreadDMCounts(prev => ({ ...prev, [conversation.id]: 0 }));
    } else {
      setUnreadGroupCounts(prev => ({ ...prev, [conversation.id]: 0 }));
    }
    
    if (conversation.type === 'group') {
      groupManagement.fetchGroupMembers(conversation.id);
      groupManagement.fetchChannels(conversation.id).then((channels) => {
        if (channels && channels.length > 0) {
          const defaultChannel: Channel = channels.find((ch: Channel) => ch.is_default) || channels[0];
          setSelectedChannel(defaultChannel.channel_id);
        }
        messages.setContextSwitchLoading(false);
      });
    } else {
      // For direct messages, always use profile messages hook
      console.log('📥 Fetching direct messages for user:', conversation.id);
      profileMessages.fetchMessages(conversation.id);
      messages.setContextSwitchLoading(false);
    }
  }, [messages, groupManagement, profileMessages]);

  // Memoized callback for fetching available users to prevent infinite re-renders
  const handleFetchAvailableUsers = useCallback(() => {
    if (selectedConversation) {
      groupManagement.fetchAvailableUsers(selectedConversation);
    }
  }, [selectedConversation, groupManagement.fetchAvailableUsers]);

  // Auto-select conversation from URL params (only once)
  useEffect(() => {
    // Only auto-select once to prevent forced navigation back
    if (hasAutoSelected || !searchParams) return;
    
    const dmUserId = searchParams.get('user');
    const profileParam = searchParams.get('profile') as ProfileType;
    
    // Set profile type from URL parameter if provided
    if (profileParam && ['basic', 'love', 'business'].includes(profileParam)) {
      setActiveProfileType(profileParam);
    }
    
    if (dmUserId) {
      // If we have a profile parameter, look in profile conversations
      if (profileParam && ['love', 'business'].includes(profileParam) && profileConversations.conversations.length > 0) {
        const targetConversation = profileConversations.conversations.find(
          pc => pc.other_user.user_id === dmUserId
        );
        if (targetConversation) {
          selectConversation({
            id: targetConversation.other_user.user_id,
            name: targetConversation.other_user.display_name || targetConversation.other_user.username,
            type: 'direct'
          });
          setHasAutoSelected(true); // Mark as auto-selected
        }
      } 
      // Fallback to regular conversations for basic profile or if profile not specified
      else if (conversations.conversations.length > 0) {
        const targetConversation = conversations.conversations.find(
          c => c.type === 'direct' && c.id === dmUserId
        );
        if (targetConversation) {
          selectConversation(targetConversation);
          setHasAutoSelected(true); // Mark as auto-selected
          // Ensure groups and invites are loaded immediately
          conversations.fetchConversations();
          groupManagement.fetchInvitations();
          groupManagement.fetchInvitationSummary();
          profileConversations.fetchConversations();
        }
        // If no existing conversation found yet, select a placeholder to force-open DM
        else {
          setSelectedCategory('unified');
          selectConversation({ id: dmUserId, name: 'Direct Message', type: 'direct' });
          setHasAutoSelected(true);
          // Still load groups/invites in the background
          conversations.fetchConversations();
          groupManagement.fetchInvitations();
          groupManagement.fetchInvitationSummary();
          profileConversations.fetchConversations();
        }
      } else {
        // No conversations loaded yet; still select a placeholder to open DM immediately
        setSelectedCategory('unified');
        selectConversation({ id: dmUserId, name: 'Direct Message', type: 'direct' });
        setHasAutoSelected(true);
        conversations.fetchConversations();
        groupManagement.fetchInvitations();
        groupManagement.fetchInvitationSummary();
        profileConversations.fetchConversations();
      }
    }
  }, [searchParams, conversations.conversations, profileConversations.conversations, hasAutoSelected]); // Added hasAutoSelected to dependencies

  // Auto-select conversation after profile conversations are loaded (for business/love profiles)
  useEffect(() => {
    // Only auto-select if we haven't already done so
    if (hasAutoSelected || !searchParams) return;
    
    const dmUserId = searchParams.get('user');
    const profileParam = searchParams.get('profile') as ProfileType;
    
    if (dmUserId && profileParam && ['love', 'business'].includes(profileParam) && 
        activeProfileType === profileParam && profileConversations.conversations.length > 0 && 
        !selectedConversation) {
      
      const targetConversation = profileConversations.conversations.find(
        pc => pc.other_user.user_id === dmUserId
      );
      
      if (targetConversation) {
        // Keep unified view; just select the conversation and refresh lists
        selectConversation({
          id: targetConversation.other_user.user_id,
          name: targetConversation.other_user.display_name || targetConversation.other_user.username,
          type: 'direct'
        });
        setHasAutoSelected(true); // Mark as auto-selected
        conversations.fetchConversations();
        groupManagement.fetchInvitations();
        groupManagement.fetchInvitationSummary();
        profileConversations.fetchConversations();
      }
    }
  }, [profileConversations.conversations, activeProfileType, selectedConversation, searchParams, hasAutoSelected]);

  // Reset auto-select flag when user manually changes profiles or conversations
  useEffect(() => {
    // If user manually changes profile type, allow them to navigate freely
    if (!searchParams) return;
    
    const profileParam = searchParams.get('profile') as ProfileType;
    if (hasAutoSelected && profileParam && activeProfileType !== profileParam) {
      setHasAutoSelected(false);
    }
  }, [activeProfileType, hasAutoSelected, searchParams]);

  // Reset auto-select flag when user manually selects a different conversation
  const selectConversationWithReset = useCallback((conversation: Conversation) => {
    if (!searchParams) {
      selectConversation(conversation);
      return;
    }
    
    const dmUserId = searchParams.get('user');
    // If user manually selects a different conversation than the URL one, reset auto-select
    if (hasAutoSelected && dmUserId && conversation.id !== dmUserId) {
      setHasAutoSelected(false);
    }
    // Reset unread mention counters when opening a group
    if (conversation.type === 'group') {
      setUnreadGroupMentions(prev => ({ ...prev, [conversation.id]: 0 }));
    }
    selectConversation(conversation);
    // On mobile, hide the conversations list after selecting a convo
    if (isMobile) {
      setIsConversationsSidebarHidden(true);
    }
  }, [selectConversation, hasAutoSelected, searchParams, isMobile]);

  // Fetch messages when channel changes
  useEffect(() => {
    if (selectedConversation && selectedConversationType === 'group' && selectedChannel) {
      messages.fetchChannelMessages(selectedConversation, selectedChannel);
    }
  }, [selectedChannel, selectedConversation, selectedConversationType, activeProfileType]); // Added activeProfileType dependency

  // Ensure we have a display name for the selected direct user; if not, fetch it and add temp conversation entry
  useEffect(() => {
    const ensureDisplayName = async (): Promise<void> => {
      if (!selectedConversation) return;
      if (selectedConversationType !== 'direct') return;

      // If already known via conversations or profileConversations, no need to fetch
      const existingProfileConv = profileConversations.conversations.find(pc => pc.other_user.user_id === selectedConversation);
      const existingConv = conversations.conversations.find(c => c.type === 'direct' && c.id === selectedConversation);
      const knownName = existingProfileConv?.other_user.display_name || existingConv?.name || displayNames[selectedConversation];
      if (knownName && knownName !== 'Unknown Contact') {
        // Optionally ensure it's present in displayNames cache
        if (!displayNames[selectedConversation]) {
          setDisplayNames(prev => ({ ...prev, [selectedConversation]: knownName }));
        }
        return;
      }

      try {
        const res = await protectedFetch('/api/users/display-names', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: [selectedConversation] })
        });
        const data: { success: boolean; displayNames?: Record<string, string> } = await res.json();
        if (data.success && data.displayNames && data.displayNames[selectedConversation]) {
          const name = data.displayNames[selectedConversation];
          setDisplayNames(prev => ({ ...prev, [selectedConversation]: name }));

          // If it's not in conversations list yet, inject a temporary direct conversation so the list shows it
          if (!existingConv) {
            conversations.setConversations(prev => {
              // Avoid duplicates
              if (prev.some(c => c.type === 'direct' && c.id === selectedConversation)) return prev;
              return [
                ...prev,
                {
                  id: selectedConversation,
                  name,
                  type: 'direct' as const,
                  user_id: selectedConversation,
                  last_activity: new Date().toISOString(),
                  unread_count: 0
                }
              ];
            });
          }
        }
      } catch {
        // best-effort; ignore
      }
    };

    void ensureDisplayName();
  }, [selectedConversation, selectedConversationType, profileConversations.conversations, conversations.conversations, protectedFetch, displayNames]);

  // Parse and handle /poll command
  const parsePollCommand = useCallback((message: string): { question: string; options: string[] } | null => {
    // Check if message starts with /poll
    if (!message.trim().startsWith('/poll ')) {
      return null;
    }

    // Remove /poll from the beginning and trim
    const pollContent = message.slice(6).trim();
    
    if (!pollContent) {
      return null;
    }

    // Split by spaces but keep quoted strings together
    const parts: string[] = [];
    let currentPart = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < pollContent.length) {
      const char = pollContent[i];
      
      if (char === '"' && (i === 0 || pollContent[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ' ' && !inQuotes) {
        if (currentPart.trim()) {
          parts.push(currentPart.trim());
          currentPart = '';
        }
      } else {
        currentPart += char;
      }
      i++;
    }
    
    // Add the last part if it exists
    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }

    // Clean up quoted strings (remove surrounding quotes)
    const cleanedParts = parts.map(part => {
      if (part.startsWith('"') && part.endsWith('"')) {
        return part.slice(1, -1);
      }
      return part;
    });

    if (cleanedParts.length < 3) {
      return null; // Need at least question + 2 options
    }

    const question = cleanedParts[0];
    const options = cleanedParts.slice(1);

    return { question, options };
  }, []);

  // Create poll from command
  const handlePollCommand = useCallback(async (question: string, options: string[]): Promise<boolean> => {
    if (!selectedConversation || selectedConversationType !== 'group') {
      return false;
    }

    try {
      const res = await protectedFetch(`/api/groups/${selectedConversation}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          options,
          profile_type: activeProfileType
        })
      });
      
      const data = await res.json();
      return data.success;
    } catch (error) {
      console.error('Error creating poll from command:', error);
      return false;
    }
  }, [selectedConversation, selectedConversationType, activeProfileType, protectedFetch]);

  // Send message handler
  const handleSendMessage = useCallback(async (overrideContent?: string) => {
    // Prevent empty messages or rapid double-clicks
    const candidate = (overrideContent ?? newMessage).trim();
    if (!candidate || profileMessages.sending || messages.sending) {
      return;
    }
    
    // Check for /poll command first
    if (!overrideContent && selectedConversationType === 'group') {
      const pollCommand = parsePollCommand(newMessage);
      if (pollCommand) {
        const success = await handlePollCommand(pollCommand.question, pollCommand.options);
        if (success) {
          setNewMessage('');
          setReplyTo(null);
        } else {
          console.error('Failed to create poll from command');
        }
        return;
      }
    }

    let success = false;
    // Prepare content, optionally E2EE-wrap for direct messages (but never wrap key-share messages)
    const raw = overrideContent ?? newMessage;
    let contentToSend = raw;
    const isShare = e2ee.isShareMessage(raw);
    const isDisable = e2ee.isDisableMessage ? e2ee.isDisableMessage(raw) : false;
    const isInfo = e2ee.isInfoMessage ? e2ee.isInfoMessage(raw) : false;
    if (!isShare && !isDisable && !isInfo && selectedConversationType === 'direct' && currentUser && selectedConversation) {
      const keyId = e2ee.getKeyId(activeProfileType, currentUser.user_id, selectedConversation);
      contentToSend = e2ee.encryptIfEnabled(keyId, raw);
    }
    
    console.log('🚀 SEND MESSAGE DEBUG:', {
  selectedConversationType,
  selectedCategory,
  activeProfileType,
  condition: selectedConversationType === 'direct' && selectedCategory === 'direct',
  payload: raw,
  replyTo,
  selectedConversation
    });
    
    // Use profile messages for direct conversations, regular messages for groups
    if (selectedConversationType === 'direct') {
      console.log('📨 Using profileMessages.sendMessage for direct message');
      success = await profileMessages.sendMessage(selectedConversation, contentToSend, overrideContent ? undefined : (replyTo || undefined));
    } else if (selectedConversationType === 'group') {
      console.log('📨 Using messages.sendMessage for group message');
      success = await messages.sendMessage(raw, overrideContent ? undefined : (replyTo || undefined));
    } else {
      console.log('📨 Fallback to messages.sendMessage');
      success = await messages.sendMessage(raw, overrideContent ? undefined : (replyTo || undefined));
    }
    
    if (success) {
      if (!overrideContent) {
        setNewMessage('');
        setReplyTo(null); // Clear reply after sending
      }

      // Ensure a conversation entry exists immediately for newly started DMs
      if (selectedConversationType === 'direct' && selectedConversation) {
  // Ensure unified category so groups and invites remain visible
  setSelectedCategory('unified');
        const name = (profileConversations.conversations.find(pc => pc.other_user.user_id === selectedConversation)?.other_user.display_name)
          || displayNames[selectedConversation]
          || 'Direct Message';
        conversations.setConversations(prev => {
          const exists = prev.some(c => c.type === 'direct' && c.id === selectedConversation);
          const updated = exists
            ? prev.map(c => c.type === 'direct' && c.id === selectedConversation
                ? { ...c, name, last_message: raw, last_activity: new Date().toISOString() }
                : c)
            : [
                ...prev,
                {
                  id: selectedConversation,
                  name,
                  type: 'direct' as const,
                  user_id: selectedConversation,
                  last_message: raw,
                  last_activity: new Date().toISOString(),
                  unread_count: 0
                }
              ];
          return updated;
        });

        // Also ensure profileConversations includes this DM immediately
        if (!profileConversations.conversations.some(pc => pc.other_user.user_id === selectedConversation)) {
          profileConversations.setConversations(prev => ([
            ...prev,
            {
              id: `temp-${selectedConversation}`,
              participant_ids: [currentUser?.user_id || 'me', selectedConversation],
              other_user: {
                user_id: selectedConversation,
                username: name,
                display_name: name
              },
              created_at: new Date(),
              updated_at: new Date(),
              latest_message: { content: raw, timestamp: new Date().toISOString(), sender_id: currentUser?.user_id || 'me' },
              profile_type: activeProfileType
            }
          ]));
        }

        // Optionally refresh groups to ensure unified list remains complete
        conversations.fetchConversations();
      }
    }
  }, [selectedConversationType, selectedCategory, activeProfileType, profileMessages, messages, newMessage, replyTo, selectedConversation, parsePollCommand, handlePollCommand]);

  // Context menu handlers
  const handleConversationContextMenu = (e: React.MouseEvent, conversation: Conversation) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'conversation',
      id: conversation.id,
      extra: conversation
    });
  };

  const handleMessageContextMenu = (e: React.MouseEvent, message: PrivateMessage | GroupMessage) => {
    e.preventDefault();
    
    // For group messages, use message_id (UUID). For private messages, use _id (ObjectId)
    const isGroupMessage = 'message_id' in message;
    const messageId = isGroupMessage ? (message as GroupMessage).message_id : (message as PrivateMessage)._id;
    
    if (!messageId) {
      console.error('🚨 No valid message ID found for context menu:', message);
      return;
    }
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'message',
      id: messageId,
      extra: message
    });
  };

  const handleChannelContextMenu = (e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'channel',
      id: channel.channel_id,
      extra: channel
    });
  };

  // Handle window resize for mobile responsiveness
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsConversationsSidebarHidden(false);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hide context menu on click elsewhere
  useEffect(() => {
    const hideMenu = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', hideMenu);
      return () => document.removeEventListener('click', hideMenu);
    }
  }, [contextMenu]);

  // Use appropriate conversation data based on the selected category
  const selectedConversationData = useMemo(() => {
    // Always use profile data for direct conversations to ensure profile-specific display names
    if (selectedConversationType === 'direct') {
      const profileConversation = profileConversations.conversations.find(
        pc => pc.other_user.user_id === selectedConversation
      );
      if (profileConversation) {
        return {
          id: selectedConversation,
          name: profileConversation.other_user.display_name || displayNames[selectedConversation] || 'Unknown Contact',
          type: 'direct' as const,
          user_id: selectedConversation
        };
      }
      // Fallback: if we have a fetched display name but no profile conversation yet, build a temporary entry
      if (selectedConversation) {
        const tempName = displayNames[selectedConversation];
        if (tempName) {
          return {
            id: selectedConversation,
            name: tempName,
            type: 'direct' as const,
            user_id: selectedConversation
          };
        }
      }
    }
    return conversations.conversations.find(c => c.id === selectedConversation);
  }, [selectedConversationType, selectedConversation, profileConversations.conversations, conversations.conversations, displayNames]);
    
  // Compute if the current user can manage members in the selected group
  const canManageMembers: boolean = selectedConversationType === 'group'
    ? groupManagement.canManageMembers(selectedConversation)
    : false;

  // Pin message function
  const pinMessage = useCallback(async (messageId: string, channelId?: string): Promise<boolean> => {
    try {
      const response = await protectedFetch(`/api/groups/${selectedConversation}/pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message_id: messageId,
          channel_id: channelId
        })
      });

      const data = await response.json();
      if (data.success) {
        // Refresh messages to show the pinned state
        if (selectedConversationType === 'group') {
          messages.fetchMessages(selectedConversation, selectedConversationType);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error pinning message:', error);
      return false;
    }
  }, [selectedConversation, selectedConversationType, messages, protectedFetch]);

  // Unpin message function
  const unpinMessage = useCallback(async (messageId: string, channelId?: string): Promise<boolean> => {
    try {
      const response = await protectedFetch(`/api/groups/${selectedConversation}/pin`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message_id: messageId,
          channel_id: channelId
        })
      });

      const data = await response.json();
      if (data.success) {
        // Refresh messages to show the unpinned state
        if (selectedConversationType === 'group') {
          messages.fetchMessages(selectedConversation, selectedConversationType);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error unpinning message:', error);
      return false;
    }
  }, [selectedConversation, selectedConversationType, messages, protectedFetch]);

  // Callback when a user accepts a group invitation: refresh conversations & members
  const handleGroupAccepted = useCallback((groupId: string) => {
    // Refresh conversation list to include the new group
    conversations.fetchConversations();
    // If currently viewing the group, refresh its members
    if (selectedConversation === groupId) {
      groupManagement.fetchGroupMembers(groupId);
    }
  }, [conversations.fetchConversations, selectedConversation, groupManagement.fetchGroupMembers]);

  // Handle pinned messages modal
  const handlePinnedMessagesClick = useCallback(() => {
    modals.openModal('showPinnedMessagesModal');
  }, [modals]);

  // Helper function to get profile type symbol
  const getProfileTypeSymbol = (profileType: 'basic' | 'love' | 'business'): string => {
    switch (profileType) {
      case 'love':
        return '♥️'; // Heart symbol for personal/love profile
      case 'business':
        return '💼'; // Green briefcase symbol for corporate/business profile
      case 'basic':
      default:
        return '👤'; // Person symbol for general/basic profile
    }
  };

  // Helper function to create conversation name with symbolic indicators
  const createConversationNameWithSymbol = (username: string, profileType: 'basic' | 'love' | 'business'): string => {
    const symbol = getProfileTypeSymbol(profileType);
    return `${symbol} ${username}`;
  };

  // Handle declining an incoming call
  const handleDeclineCall = useCallback((call: VoiceCallEventData) => {
    stopCallSound(); // Stop the ringing sound
    
    // Send decline notification to server
    protectedFetch('/api/voice-calls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call_id: call.call_id,
        status: 'declined'
      })
    }).catch(error => {
      console.error('Failed to decline call:', error);
    });
    
    // Remove from incoming calls
    setIncomingCalls(prev => ({
      ...prev,
      incomingCalls: prev.incomingCalls.filter(c => c.call_id !== call.call_id)
    }));
  }, [stopCallSound, protectedFetch]);

  if (loading) {
    return (
      <div className={`flex-1 flex items-center justify-center ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>
        <div className="text-center">
          <h2 className="text-2xl mb-4">Loading...</h2>
          <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Setting up your messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>
      {/* Mobile overlay */}
      {isMobile && !isConversationsSidebarHidden && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsConversationsSidebarHidden(true)}
        />
      )}

      {/* Main Content Container */}
      <div className={`flex-1 flex ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'} h-full overflow-hidden relative`}>

  {/* Main navigation sidebar - hidden on /chat per requirement */}
  {/* Sidebar removed on /chat */}

      {/* Conversations list */}
      {isMobile ? (
        !isConversationsSidebarHidden && (
          <div className="fixed top-0 left-0 h-full z-50">
            <ConversationsList
              conversations={
                selectedCategory === 'unified' 
                  ? (() => {
                      // Get direct conversations from profile conversations
                      const directConversations = profileConversations.conversations.map(pc => ({
                        id: pc.other_user.user_id,
                        name: createConversationNameWithSymbol(pc.other_user.display_name || pc.other_user.username, activeProfileType),
                        type: 'direct' as const,
                        last_message: pc.latest_message?.content,
                        last_activity: pc.latest_message?.timestamp || pc.created_at.toString(),
                        unread_count: unreadDMCounts[pc.other_user.user_id] || 0,
                        user_id: pc.other_user.user_id,
                      }));
                      const groupConversations = conversations.conversations
                        .filter(c => c.type === 'group')
                        .map(c => ({ ...c, unread_count: unreadGroupCounts[c.id] ?? c.unread_count ?? 0, has_mention: (unreadGroupMentions[c.id] ?? 0) > 0 }));
                      const combined = [...directConversations, ...groupConversations];
                      if (combined.length === 0) return combined;
                      const toTime = (x: { last_activity?: string | number | Date }): number => new Date(x.last_activity || 0).getTime();
                      const cmp = (a: { unread_count?: number; last_activity?: string | number | Date; name?: string }, b: { unread_count?: number; last_activity?: string | number | Date; name?: string }): number => {
                        const aUnread = (a.unread_count ?? 0) > 0 ? 1 : 0;
                        const bUnread = (b.unread_count ?? 0) > 0 ? 1 : 0;
                        if (aUnread !== bUnread) return bUnread - aUnread;
                        const at = toTime(a);
                        const bt = toTime(b);
                        if (at !== bt) return bt - at;
                        return (a.name || '').localeCompare(b.name || '');
                      };
                      let latestIdx = 0;
                      let latestTime = toTime(combined[0]);
                      for (let i = 1; i < combined.length; i++) {
                        const t = toTime(combined[i]);
                        if (t > latestTime) { latestTime = t; latestIdx = i; }
                      }
                      const pinned = combined[latestIdx];
                      const rest = combined.filter((_, i) => i !== latestIdx).sort(cmp);
                      return [pinned, ...rest];
                    })()
                  : selectedCategory === 'direct' 
            ? (() => {
                  const list = profileConversations.conversations
                    .map(pc => ({
                      id: pc.other_user.user_id,
                      name: createConversationNameWithSymbol(pc.other_user.display_name || pc.other_user.username, activeProfileType),
                      type: 'direct' as const,
                      last_message: pc.latest_message?.content,
                      last_activity: pc.latest_message?.timestamp || pc.created_at.toString(),
                      unread_count: unreadDMCounts[pc.other_user.user_id] || 0,
                      user_id: pc.other_user.user_id,
                    }));
                  if (list.length === 0) return list;
                  const toTime = (x: { last_activity?: string | number | Date }): number => new Date(x.last_activity || 0).getTime();
                  const cmp = (a: { unread_count?: number; last_activity?: string | number | Date; name?: string }, b: { unread_count?: number; last_activity?: string | number | Date; name?: string }): number => {
                    const aUnread = (a.unread_count ?? 0) > 0 ? 1 : 0;
                    const bUnread = (b.unread_count ?? 0) > 0 ? 1 : 0;
                    if (aUnread !== bUnread) return bUnread - aUnread;
                    const at = toTime(a);
                    const bt = toTime(b);
                    if (at !== bt) return bt - at;
                    return (a.name || '').localeCompare(b.name || '');
                  };
                  let latestIdx = 0;
                  let latestTime = toTime(list[0]);
                  for (let i = 1; i < list.length; i++) {
                    const t = toTime(list[i]);
                    if (t > latestTime) { latestTime = t; latestIdx = i; }
                  }
                  const pinned = list[latestIdx];
                  const rest = list.filter((_, i) => i !== latestIdx).sort(cmp);
                  return [pinned, ...rest];
                })()
            : (() => {
                const list = conversations.conversations
                  .filter(c => c.type === 'group')
                  .map(c => ({
                    ...c,
                    unread_count: unreadGroupCounts[c.id] ?? c.unread_count ?? 0,
                    has_mention: (unreadGroupMentions[c.id] ?? 0) > 0
                  }));
                if (list.length === 0) return list;
                const toTime = (x: { last_activity?: string | number | Date }): number => new Date(x.last_activity || 0).getTime();
                const cmp = (a: { unread_count?: number; last_activity?: string | number | Date; name?: string }, b: { unread_count?: number; last_activity?: string | number | Date; name?: string }): number => {
                  const aUnread = (a.unread_count ?? 0) > 0 ? 1 : 0;
                  const bUnread = (b.unread_count ?? 0) > 0 ? 1 : 0;
                  if (aUnread !== bUnread) return bUnread - aUnread;
                  const at = toTime(a);
                  const bt = toTime(b);
                  if (at !== bt) return bt - at;
                  return (a.name || '').localeCompare(b.name || '');
                };
                let latestIdx = 0;
                let latestTime = toTime(list[0]);
                for (let i = 1; i < list.length; i++) {
                  const t = toTime(list[i]);
                  if (t > latestTime) { latestTime = t; latestIdx = i; }
                }
                const pinned = list[latestIdx];
                const rest = list.filter((_, i) => i !== latestIdx).sort(cmp);
                return [pinned, ...rest];
              })()
              }
              selectedCategory={selectedCategory}
              selectedConversation={selectedConversation}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSelectConversation={selectConversationWithReset}
              onConversationContextMenu={handleConversationContextMenu}
              isConversationsSidebarHidden={isConversationsSidebarHidden}
              setIsConversationsSidebarHidden={setIsConversationsSidebarHidden}
              isConnected={isConnected}
              connectionError={connectionError}
              sessionToken={sessionToken}
              onReconnect={refreshConnection}
              currentUser={currentUser}
              activeProfileType={activeProfileType}
              setActiveProfileType={setActiveProfileType}
              invitationSummary={groupManagement.invitationSummary}
              getUserStatus={userStatus.getUserStatus}
              onStatusChange={async (userId: string, status: UserStatus, customMessage?: string) => {
                if (userId === currentUser?.user_id) {
                  return await userStatus.updateStatus(status, customMessage);
                }
                return false;
              }}
              onCreateGroup={() => modals.openModal('showCreateGroupModal')}
              onNewMessage={() => modals.openModal('showNewDMModal')}
            />
          </div>
        )
      ) : (
        <ConversationsList
        conversations={
          selectedCategory === 'unified' 
            ? (() => {
                // Get direct conversations from profile conversations
                const directConversations = profileConversations.conversations.map(pc => ({
                  id: pc.other_user.user_id,
                  name: createConversationNameWithSymbol(pc.other_user.display_name || pc.other_user.username, activeProfileType),
                  type: 'direct' as const,
                  last_message: pc.latest_message?.content,
                  last_activity: pc.latest_message?.timestamp || pc.created_at.toString(),
                  unread_count: unreadDMCounts[pc.other_user.user_id] || 0,
                  user_id: pc.other_user.user_id,
                }));
                
                // Get group conversations (filter out any direct conversations to avoid duplicates)
                const groupConversations = conversations.conversations
                  .filter(c => c.type === 'group')
                  .map(c => ({ ...c, unread_count: unreadGroupCounts[c.id] ?? c.unread_count ?? 0, has_mention: (unreadGroupMentions[c.id] ?? 0) > 0 }));
                
                // Combine
                const combined = [...directConversations, ...groupConversations];
                if (combined.length === 0) return combined;
                const toTime = (x: { last_activity?: string | number | Date }): number => new Date(x.last_activity || 0).getTime();
                const cmp = (a: { unread_count?: number; last_activity?: string | number | Date; name?: string }, b: { unread_count?: number; last_activity?: string | number | Date; name?: string }): number => {
                  const aUnread = (a.unread_count ?? 0) > 0 ? 1 : 0;
                  const bUnread = (b.unread_count ?? 0) > 0 ? 1 : 0;
                  if (aUnread !== bUnread) return bUnread - aUnread;
                  const at = toTime(a);
                  const bt = toTime(b);
                  if (at !== bt) return bt - at;
                  return (a.name || '').localeCompare(b.name || '');
                };
                // Pin most recent conversation at top regardless of unread status
                let latestIdx = 0;
                let latestTime = toTime(combined[0]);
                for (let i = 1; i < combined.length; i++) {
                  const t = toTime(combined[i]);
                  if (t > latestTime) { latestTime = t; latestIdx = i; }
                }
                const pinned = combined[latestIdx];
                const rest = combined.filter((_, i) => i !== latestIdx).sort(cmp);
                return [pinned, ...rest];
              })()
            : selectedCategory === 'direct' 
        ? (() => {
              const list = profileConversations.conversations
                .map(pc => ({
                  id: pc.other_user.user_id,
                  name: createConversationNameWithSymbol(pc.other_user.display_name || pc.other_user.username, activeProfileType),
                  type: 'direct' as const,
                  last_message: pc.latest_message?.content,
                  last_activity: pc.latest_message?.timestamp || pc.created_at.toString(),
                  unread_count: unreadDMCounts[pc.other_user.user_id] || 0,
                  user_id: pc.other_user.user_id,
                }));
              if (list.length === 0) return list;
              const toTime = (x: { last_activity?: string | number | Date }): number => new Date(x.last_activity || 0).getTime();
              const cmp = (a: { unread_count?: number; last_activity?: string | number | Date; name?: string }, b: { unread_count?: number; last_activity?: string | number | Date; name?: string }): number => {
                const aUnread = (a.unread_count ?? 0) > 0 ? 1 : 0;
                const bUnread = (b.unread_count ?? 0) > 0 ? 1 : 0;
                if (aUnread !== bUnread) return bUnread - aUnread;
                const at = toTime(a);
                const bt = toTime(b);
                if (at !== bt) return bt - at;
                return (a.name || '').localeCompare(b.name || '');
              };
              let latestIdx = 0;
              let latestTime = toTime(list[0]);
              for (let i = 1; i < list.length; i++) {
                const t = toTime(list[i]);
                if (t > latestTime) { latestTime = t; latestIdx = i; }
              }
              const pinned = list[latestIdx];
              const rest = list.filter((_, i) => i !== latestIdx).sort(cmp);
              return [pinned, ...rest];
            })()
        : (() => {
            const list = conversations.conversations
              .filter(c => c.type === 'group')
              .map(c => ({
                ...c,
                unread_count: unreadGroupCounts[c.id] ?? c.unread_count ?? 0,
                has_mention: (unreadGroupMentions[c.id] ?? 0) > 0
              }));
            if (list.length === 0) return list;
            const toTime = (x: { last_activity?: string | number | Date }): number => new Date(x.last_activity || 0).getTime();
            const cmp = (a: { unread_count?: number; last_activity?: string | number | Date; name?: string }, b: { unread_count?: number; last_activity?: string | number | Date; name?: string }): number => {
              const aUnread = (a.unread_count ?? 0) > 0 ? 1 : 0;
              const bUnread = (b.unread_count ?? 0) > 0 ? 1 : 0;
              if (aUnread !== bUnread) return bUnread - aUnread;
              const at = toTime(a);
              const bt = toTime(b);
              if (at !== bt) return bt - at;
              return (a.name || '').localeCompare(b.name || '');
            };
            let latestIdx = 0;
            let latestTime = toTime(list[0]);
            for (let i = 1; i < list.length; i++) {
              const t = toTime(list[i]);
              if (t > latestTime) { latestTime = t; latestIdx = i; }
            }
            const pinned = list[latestIdx];
            const rest = list.filter((_, i) => i !== latestIdx).sort(cmp);
            return [pinned, ...rest];
          })()
        }
        selectedCategory={selectedCategory}
        selectedConversation={selectedConversation}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSelectConversation={selectConversationWithReset}
        onConversationContextMenu={handleConversationContextMenu}
        isConversationsSidebarHidden={isConversationsSidebarHidden}
        setIsConversationsSidebarHidden={setIsConversationsSidebarHidden}
        // SSE status props
        isConnected={isConnected}
        connectionError={connectionError}
        sessionToken={sessionToken}
        onReconnect={refreshConnection}
        currentUser={currentUser}
        // Profile switcher props
        activeProfileType={activeProfileType}
        setActiveProfileType={setActiveProfileType}
        // Invitation summary prop
        invitationSummary={groupManagement.invitationSummary}
        // Status props
        getUserStatus={userStatus.getUserStatus}
        onStatusChange={async (userId: string, status: UserStatus, customMessage?: string) => {
          // Only allow changing the current user's status
          if (userId === currentUser?.user_id) {
            return await userStatus.updateStatus(status, customMessage);
          }
          return false;
        }}
        // Action props
        onCreateGroup={() => modals.openModal('showCreateGroupModal')}
        onNewMessage={() => modals.openModal('showNewDMModal')}
  />
  )}

      {/* Chat area */}
      <ChatArea
        selectedConversation={selectedConversation}
        selectedConversationType={selectedConversationType}
        selectedChannel={selectedChannel}
        setSelectedChannel={setSelectedChannel}
        selectedConversationData={selectedConversationData}
        groupChannels={groupManagement.groupChannels}
        messages={
          selectedConversationType === 'direct'
            ? profileMessages.messages
            : messages.messages
        }
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        onSendMessage={handleSendMessage}
        onMessageContextMenu={handleMessageContextMenu}
        currentUser={currentUser}
        channelLoading={messages.channelLoading}
        contextSwitchLoading={messages.contextSwitchLoading}
        sending={
          selectedConversationType === 'direct' && selectedCategory === 'direct'
            ? profileMessages.sending
            : messages.sending
        }
        isMobile={isMobile}
        isConversationsSidebarHidden={isConversationsSidebarHidden}
        setIsConversationsSidebarHidden={setIsConversationsSidebarHidden}
        onMembersClick={() => modals.openModal('showMembersModal')}
        onInviteClick={() => modals.openModal('showInviteModal')}
        onBannedUsersClick={() => {
          groupManagement.fetchBannedUsers(selectedConversation);
          modals.openModal('showBannedUsersModal');
        }}
        onCreateChannelClick={() => modals.openModal('showCreateChannelModal')}
        onPinnedMessagesClick={handlePinnedMessagesClick}
        onChannelContextMenu={handleChannelContextMenu}
        canManageMembers={canManageMembers}
        typingUsers={typingIndicator.typingUsers}
        onTyping={typingIndicator.emitTyping}
        sessionToken={sessionToken}
        onInitiateCall={incomingCalls.initiateCall}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        activeProfileType={activeProfileType}
        onRefreshMessages={async () => {
          console.log('🔄 Refreshing messages after poll creation...', {
            selectedConversationType,
            selectedCategory,
            selectedConversation,
            activeProfileType
          });
          if (selectedConversationType === 'direct' && selectedCategory === 'direct') {
            console.log('📨 Using profileMessages.fetchMessages');
            await profileMessages.fetchMessages(selectedConversation);
          } else {
            console.log('📨 Using messages.fetchMessages');
            await messages.fetchMessages(selectedConversation, selectedConversationType);
          }
          console.log('✅ Messages refresh completed');
        }}
        // Status props
        getUserStatus={userStatus.getUserStatus}
  invitationsCount={groupManagement.invitations?.length ?? 0}
  onInvitationsClick={() => modals.openModal('showInvitationsModal')}
      />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          contextMenu={{ ...contextMenu, extra: (contextMenu.extra ?? {}) as { [key: string]: unknown; user_id?: string; members?: { user_id: string; role: string }[] } }}
          setContextMenu={setContextMenu}
          conversations={{
            conversations: conversations.conversations,
            fetchConversations: conversations.fetchConversations,
            deleteConversation: async (id: string): Promise<boolean> => {
              try {
                // Check if this is the currently selected conversation
                const isCurrentlySelected = selectedConversation === id;
                
                // Determine if it's a direct message by looking in profileConversations first
                const isDirectMessage = profileConversations.conversations.some(c => c.other_user.user_id === id);
                
                let deleteSuccess = false;
                
                if (isDirectMessage) {
                  // Use profile conversations delete which sends proper profile types
                  deleteSuccess = await profileConversations.deleteConversation(id);
                } else {
                  // Use regular conversations delete for group conversations
                  const conversation = conversations.conversations.find(c => c.id === id);
                  if (conversation) {
                    await conversations.deleteConversation(conversation);
                    deleteSuccess = true;
                  }
                }
                
                // Clear the selected conversation if it was the one being deleted
                if (deleteSuccess && isCurrentlySelected) {
                  setSelectedConversation('');
                  setSelectedConversationType('direct');
                }
                
                // Refresh both conversation lists to ensure consistency
                if (deleteSuccess) {
                  conversations.fetchConversations();
                  profileConversations.fetchConversations();
                }
                
                return deleteSuccess;
              } catch (error) {
                console.error('Error deleting conversation:', error);
                return false;
              }
            },
            leaveGroup: async (id: string): Promise<boolean> => {
              try {
                const res = await fetch('/api/groups/leave', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    group_id: id,
                    profile_type: activeProfileType
                  })
                });
                const data = await res.json();
                if (data.success) {
                  // Refresh conversations list
                  conversations.fetchConversations();
                  // If we're currently viewing this group, clear the selection
                  if (selectedConversation === id) {
                    setSelectedConversation('');
                    setSelectedConversationType('direct');
                  }
                  return true;
                }
                return false;
              } catch (error) {
                console.error('Error leaving group:', error);
                return false;
              }
            }
          }}
          groupManagement={{
            ...groupManagement,
            groupMembers: groupManagement.groupMembers,
            fetchChannels: groupManagement.fetchChannels,
            groupChannels: groupManagement.groupChannels
          }}
          messages={{ 
            deleteMessage: selectedConversationType === 'direct' 
              ? profileMessages.deleteMessage 
              : messages.deleteMessage,
            setReplyTo: setReplyTo,
            pinMessage: pinMessage,
            unpinMessage: unpinMessage
          }}
          currentUser={currentUser}
          selectedChannel={selectedChannel}
          setSelectedChannel={setSelectedChannel}
          selectedConversation={selectedConversation}
          selectedConversationType={selectedConversationType}
        />
      )}

      {/* Modals */}
      {modals.modals.showCreateGroupModal && (
        <CreateGroupModal
          onClose={() => modals.closeModal('showCreateGroupModal')}
          currentUser={currentUser}
          activeProfileType={activeProfileType}
          onSuccess={() => {
            conversations.fetchConversations();
            modals.closeModal('showCreateGroupModal');
          }}
        />
      )}

      {modals.modals.showNewDMModal && (
        <NewDMModal
          onClose={() => modals.closeModal('showNewDMModal')}
          onSuccess={(conversation) => {
            selectConversation(conversation);
            // Refresh both conversation types
            conversations.fetchConversations();
            profileConversations.fetchConversations();
            modals.closeModal('showNewDMModal');
          }}
          senderProfileType={activeProfileType}
          receiverProfileType={activeProfileType}
        />
      )}

      {modals.modals.showCreateChannelModal && (
        <CreateChannelModal
          selectedConversation={selectedConversation}
          onClose={() => modals.closeModal('showCreateChannelModal')}
          onSuccess={() => {
            groupManagement.fetchChannels(selectedConversation);
            modals.closeModal('showCreateChannelModal');
          }}
          profileType={activeProfileType}
        />
      )}

      {modals.modals.showPinnedMessagesModal && (
        <PinnedMessagesModal
          isOpen={modals.modals.showPinnedMessagesModal}
          onClose={() => modals.closeModal('showPinnedMessagesModal')}
          groupId={selectedConversation}
          channelId={selectedChannel}
          currentUser={currentUser}
          onVote={async (pollId: string, optionId: string) => {
            // Handle poll voting in pinned messages
            try {
              const endpoint = selectedChannel
                ? `/api/groups/${selectedConversation}/channels/${selectedChannel}/polls/${pollId}/vote`
                : `/api/groups/${selectedConversation}/polls/${pollId}/vote`;

              const response = await protectedFetch(endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  option_id: optionId,
                  profile_type: activeProfileType
                }),
              });

              if (response.ok) {
                // Optionally refresh the pinned messages to show updated vote counts
                console.log('Vote cast successfully in pinned message');
              }
            } catch (error) {
              console.error('Error voting on poll in pinned message:', error);
            }
          }}
        />
      )}

      {modals.modals.showMembersModal && (
        <MembersModal
          groupMembers={groupManagement.groupMembers}
          canManageMembers={canManageMembers}
          currentUser={currentUser}
          selectedConversation={selectedConversation}
          onPromoteToAdmin={async (groupId: string, userId: string) => {
            const success = await groupManagement.promoteToAdmin(groupId, userId);
            if (success) {
              // Refresh member list after successful promotion
              await groupManagement.fetchGroupMembers(groupId);
            }
          }}
          onDemoteToMember={async (groupId: string, userId: string) => {
            const success = await groupManagement.demoteToMember(groupId, userId);
            if (success) {
              // Refresh member list after successful demotion
              await groupManagement.fetchGroupMembers(groupId);
            }
          }}
          onKickMember={async (groupId: string, userId: string) => {
            const success = await groupManagement.removeGroupMember(groupId, userId);
            if (success) {
              // Refresh member list after successful removal
              await groupManagement.fetchGroupMembers(groupId);
            }
          }}
          onBanMember={async (groupId: string, userId: string) => {
            const success = await groupManagement.banMember(groupId, userId);
            if (success) {
              // Refresh member list after successful ban
              await groupManagement.fetchGroupMembers(groupId);
            }
          }}
          onClose={() => modals.closeModal('showMembersModal')}
        />
      )}

      {modals.modals.showInviteModal && (
        <InviteModal
          availableUsers={groupManagement.availableUsers}
          onClose={() => modals.closeModal('showInviteModal')}
          onInvite={(userId) => groupManagement.inviteUser(selectedConversation, userId)}
          onFetchUsers={handleFetchAvailableUsers}
        />
      )}

      {modals.modals.showInvitationsModal && (
        <InvitationsModal
          invitations={groupManagement.invitations}
          onClose={() => modals.closeModal('showInvitationsModal')}
          onRespond={groupManagement.respondToInvitation}
          onRefresh={groupManagement.fetchInvitations}
          onAcceptGroup={handleGroupAccepted} // notify on acceptance
        />
      )}

      {modals.modals.showBannedUsersModal && (
        <BannedUsersModal
          bannedUsers={groupManagement.bannedUsers}
          canManageMembers={canManageMembers}
          selectedConversation={selectedConversation}
          onUnbanMember={async (groupId: string, userId: string) => {
            const success = await groupManagement.unbanMember(groupId, userId);
            if (success) {
              // Refresh banned users list after successful unban
              await groupManagement.fetchBannedUsers(groupId);
            }
          }}
          onClose={() => modals.closeModal('showBannedUsersModal')}
        />
      )}

      {/* Incoming Call Modal */}
      {incomingCalls.incomingCalls.length > 0 && currentUser && (
        <VoiceCall
          isOpen={true}
          onClose={() => handleDeclineCall(incomingCalls.incomingCalls[0])}
          currentUser={currentUser}
          otherUser={{
            user_id: incomingCalls.incomingCalls[0].caller_id,
            username: incomingCalls.incomingCalls[0].caller_username,
            display_name: incomingCalls.incomingCalls[0].caller_display_name
          }}
          isIncoming={true}
          onCallEnd={() => {
            stopCallSound();
            incomingCalls.endCall(incomingCalls.incomingCalls[0].call_id);
          }}
          callId={incomingCalls.incomingCalls[0].call_id}
        />
      )}

      {/* Outgoing Call Modal */}
      {outgoingCall.isActive && outgoingCall.otherUser && currentUser && (
        <VoiceCall
          ref={voiceCallRef}
          isOpen={true}
          onClose={() => setOutgoingCall({ isActive: false, otherUser: null, callId: null })}
          currentUser={currentUser}
          otherUser={outgoingCall.otherUser}
          isIncoming={false}
          onCallEnd={() => setOutgoingCall({ isActive: false, otherUser: null, callId: null })}
        />
      )}
      </div>
    </div>
  );
};

// Exported component wraps inner logic with NotificationsProvider
const UnifiedMessages: React.FC = () => (
  <NotificationsProvider>
    <UnifiedMessagesInner />
  </NotificationsProvider>
);

export default UnifiedMessages;