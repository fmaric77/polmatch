import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useConversations } from './hooks/useConversations';
import { useProfileConversations, useProfileMessages } from './hooks/useProfileMessaging';
import type { ProfileMessage } from './hooks/useProfileMessaging';
import { useGroupManagement } from './hooks/useGroupManagement';
import { useModalStates } from './hooks/useModalStates';
import { useMessages } from './hooks/useMessages';
import { useWebSocket } from './hooks/useWebSocket';
import type { NewMessageData, NewConversationData } from './hooks/useWebSocket';
import { useTypingIndicator } from './hooks/useTypingIndicator';
import SidebarNavigation from './SidebarNavigation';
import ConversationsList from './ConversationsList';
import ChatArea from './ChatArea';
import CreateGroupModal from './modals/CreateGroupModal';
import StartConversationModal from './modals/StartConversationModal';
import MembersModal from './modals/MembersModal';
import BannedUsersModal from './modals/BannedUsersModal';
import InviteModal from './modals/InviteModal';
import InvitationsModal from './modals/InvitationsModal';
import CreateChannelModal from './modals/CreateChannelModal';
import ContextMenu from './modals/ContextMenu';

type ProfileType = 'basic' | 'love' | 'business';

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
  sender_display_name?: string;
  current_user_read: boolean;
  total_members: number;
  read_count: number;
  read_by_others: boolean;
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

const UnifiedMessages: React.FC = () => {
  // Core state
  const [currentUser, setCurrentUser] = useState<{ user_id: string; username: string; display_name?: string; is_admin?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Profile separation state
  const [activeProfileType, setActiveProfileType] = useState<ProfileType>('basic');
  
  // Navigation state
  const [selectedCategory, setSelectedCategory] = useState<'direct' | 'groups'>('direct');
  const [selectedConversation, setSelectedConversation] = useState<string>('');
  const [selectedConversationType, setSelectedConversationType] = useState<'direct' | 'group'>('direct');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile state
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isConversationsSidebarHidden, setIsConversationsSidebarHidden] = useState(false);

  // Message input state
  const [newMessage, setNewMessage] = useState('');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'conversation' | 'message' | 'member' | 'channel';
    id: string;
    extra?: unknown;
  } | null>(null);

  // Custom hooks
  const conversations = useConversations(currentUser, activeProfileType);
  const profileConversations = useProfileConversations(activeProfileType);
  const profileMessages = useProfileMessages(activeProfileType);
  const groupManagement = useGroupManagement(currentUser);
  const modals = useModalStates();
  const messages = useMessages(
    currentUser,
    selectedConversation,
    selectedConversationType,
    selectedChannel,
    groupManagement.groupChannels
  );

  // Session token for SSE
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Typing indicator hook
  const typingIndicator = useTypingIndicator({
    currentUser,
    selectedConversation,
    selectedConversationType,
    selectedChannel,
    sessionToken
  });

  // Debug session token changes
  useEffect(() => {
    console.log('🔧 Session token changed:', sessionToken ? sessionToken.substring(0, 10) + '...' : 'null');
  }, [sessionToken]);

  // Real-time messaging integration
  const { isConnected, connectionError } = useWebSocket(sessionToken, {
    onNewMessage: (data: NewMessageData) => {
      console.log('Received new message via SSE:', data);
      
      // Skip if this user is the sender (they already have the message from the send API)
      if (data.sender_id === currentUser?.user_id) {
        console.log('Skipping SSE message from self:', data.message_id);
        return;
      }
      
      // Handle direct messages - check if we're in profile mode
      if (selectedConversation && selectedConversationType === 'direct' && 
          ((data.sender_id === selectedConversation && data.receiver_id === currentUser?.user_id) ||
           (data.sender_id === currentUser?.user_id && data.receiver_id === selectedConversation))) {
        
        // If we're viewing profile conversations, use profile messages
        if (selectedCategory === 'direct') {
          // Add the message directly to profile messages state for instant display
          const newProfileMessage: ProfileMessage = {
            _id: data.message_id,
            sender_id: data.sender_id,
            receiver_id: data.receiver_id,
            content: data.content,
            timestamp: data.timestamp,
            read: false,
            attachments: (data as { attachments?: string[] }).attachments || [],
            profile_type: activeProfileType
          };
          
          profileMessages.setMessages(prevMessages => {
            // Check for duplicates
            const messageExists = prevMessages.some(msg => msg._id === data.message_id);
            if (messageExists) {
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
            attachments: (data as { attachments?: string[] }).attachments || []
          };
          
          messages.setMessages(prevMessages => {
            console.log('Adding SSE direct message. Current count:', prevMessages.length);
            
            // Comprehensive duplicate check using both _id and message_id
            const messageExists = prevMessages.some(msg => {
              const msgId = ('_id' in msg) ? msg._id : ('message_id' in msg) ? (msg as GroupMessage).message_id : null;
              return msgId === newMessage._id || msgId === data.message_id;
            });
            
            if (messageExists) {
              console.log('Direct message already exists, skipping:', data.message_id);
              return prevMessages;
            }
            
            console.log('Adding new direct message via SSE:', data.message_id);
            const updatedMessages = [...prevMessages, newMessage];
            return updatedMessages.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
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
            read_by_others: groupData.read_by_others || false
          };
          messages.setMessages(prevMessages => {
            console.log('Adding SSE group message. Current count:', prevMessages.length);
            
            // Comprehensive duplicate check using both _id and message_id
            const messageExists = prevMessages.some(msg => {
              const msgId = ('_id' in msg) ? (msg as PrivateMessage)._id : ('message_id' in msg) ? (msg as GroupMessage).message_id : null;
              return msgId === newMessage.message_id || msgId === groupData.message_id;
            });
            if (messageExists) {
              return prevMessages;
            }
            const updatedMessages = [...prevMessages, newMessage];
            return updatedMessages.sort((a, b) => 
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        }
      }
      
      // Refresh conversations list to update last message/unread count
      conversations.fetchConversations();
      profileConversations.fetchConversations();
    },
    
    onNewConversation: (data: NewConversationData) => {
      console.log('Received new conversation via SSE:', data);
      
      // If this involves the current user, refresh conversations
      if (currentUser && data.participants.includes(currentUser.user_id)) {
        conversations.fetchConversations();
        profileConversations.fetchConversations();
      }
    },
    
    onConnectionEstablished: () => {
      console.log('SSE connection established successfully');
    },
    
    onTypingStart: (data) => {
      console.log('Received typing start via SSE:', data);
      typingIndicator.handleTypingReceived(data);
    },
    
    onTypingStop: (data) => {
      console.log('Received typing stop via SSE:', data);
      typingIndicator.handleStoppedTyping(data);
    }
  });

  // Debug SSE connection status
  useEffect(() => {
    console.log('🔧 SSE connection status:', { isConnected, connectionError, sessionToken: sessionToken ? 'present' : 'null' });
  }, [isConnected, connectionError, sessionToken]);

  const searchParams = useSearchParams();

  // Fetch current user and session token
  useEffect(() => {
    console.log('🔧 Fetching session data...');
    fetch('/api/session')
      .then(res => res.json())
      .then(data => {
        console.log('🔧 Session response:', data);
        if (data.valid && data.user) {
          setCurrentUser({ 
            user_id: data.user.user_id, 
            username: data.user.username, 
            is_admin: data.user.is_admin 
          });
          // Set session token for SSE authentication
          if (data.sessionToken) {
            console.log('🔧 Setting session token:', data.sessionToken.substring(0, 10) + '...');
            setSessionToken(data.sessionToken);
          } else {
            console.error('🔧 No session token in response!');
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('🔧 Session fetch error:', err);
        setLoading(false);
      });
  }, []);

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
      profileConversations.fetchConversations();
    }
  }, [currentUser]); // Only depend on currentUser to prevent infinite loops

  // Fetch profile conversations when profile type changes
  useEffect(() => {
    if (currentUser) {
      profileConversations.fetchConversations();
    }
  }, [activeProfileType, currentUser]);

  // Clear and refetch messages when profile type changes for selected conversation
  useEffect(() => {
    if (currentUser && selectedConversation && selectedConversationType === 'direct' && selectedCategory === 'direct') {
      // Fetch messages for the new profile type (clearing is handled by the hook)
      profileMessages.fetchMessages(selectedConversation);
    }
  }, [activeProfileType, selectedConversation, selectedConversationType, selectedCategory, currentUser]);

  // Handle conversation selection
  const selectConversation = useCallback((conversation: Conversation) => {
    messages.setContextSwitchLoading(conversation.type === 'group');
    
    setSelectedConversation(conversation.id);
    setSelectedConversationType(conversation.type);
    
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
      // For direct messages, fetch using appropriate hook
      if (selectedCategory === 'direct') {
        profileMessages.fetchMessages(conversation.id);
      } else {
        messages.fetchMessages(conversation.id, conversation.type);
      }
      messages.setContextSwitchLoading(false);
    }
  }, [messages, groupManagement]);

  // Memoized callback for fetching available users to prevent infinite re-renders
  const handleFetchAvailableUsers = useCallback(() => {
    if (selectedConversation) {
      groupManagement.fetchAvailableUsers(selectedConversation);
    }
  }, [selectedConversation, groupManagement.fetchAvailableUsers]);

  // Auto-select conversation from URL params
  useEffect(() => {
    const dmUserId = searchParams.get('user');
    if (dmUserId && conversations.conversations.length > 0) {
      const targetConversation = conversations.conversations.find(
        c => c.type === 'direct' && c.id === dmUserId
      );
      if (targetConversation) {
        selectConversation(targetConversation);
      }
    }
  }, [searchParams, conversations.conversations, selectConversation]);

  // Fetch messages when channel changes
  useEffect(() => {
    if (selectedConversation && selectedConversationType === 'group' && selectedChannel) {
      messages.fetchChannelMessages(selectedConversation, selectedChannel);
    }
  }, [selectedChannel, selectedConversation, selectedConversationType]); // Removed messages dependency to prevent infinite loops

  // Send message handler
  const handleSendMessage = useCallback(async () => {
    let success = false;
    
    // Use profile messages for direct conversations, regular messages for groups
    if (selectedConversationType === 'direct' && selectedCategory === 'direct') {
      success = await profileMessages.sendMessage(selectedConversation, newMessage);
    } else {
      success = await messages.sendMessage(newMessage);
    }
    
    if (success) {
      setNewMessage('');
    }
  }, [selectedConversationType, selectedCategory, profileMessages, messages, newMessage]);

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
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'message',
      id: (message as PrivateMessage)._id || (message as GroupMessage).message_id,
      extra: message
    });
  };

  const handleChannelContextMenu = (e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    const currentUserMember = groupManagement.groupMembers.find(m => m.user_id === currentUser?.user_id);
    const isOwner = currentUserMember?.role === 'owner';
    
    if (!isOwner || channel.is_default) return;
    
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
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarVisible(false);
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

  const selectedConversationData = conversations.conversations.find(c => c.id === selectedConversation);
  // Compute if the current user can manage members in the selected group
  const canManageMembers: boolean = selectedConversationType === 'group'
    ? groupManagement.canManageMembers(selectedConversation)
    : false;

  // Callback when a user accepts a group invitation: refresh conversations & members
  const handleGroupAccepted = useCallback((groupId: string) => {
    // Refresh conversation list to include the new group
    conversations.fetchConversations();
    // If currently viewing the group, refresh its members
    if (selectedConversation === groupId) {
      groupManagement.fetchGroupMembers(groupId);
    }
  }, [conversations.fetchConversations, selectedConversation, groupManagement.fetchGroupMembers]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <h2 className="text-2xl mb-4">Loading...</h2>
          <p className="text-gray-400">Setting up your messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-black text-white h-full overflow-hidden relative">
      {/* Mobile overlay */}
      {isMobile && isSidebarVisible && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarVisible(false)}
        />
      )}

      {/* Main navigation sidebar */}
      <SidebarNavigation
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        invitationsCount={groupManagement.invitations?.length ?? 0}
        currentUser={currentUser}
        isMobile={isMobile}
        isSidebarVisible={isSidebarVisible}
        isConversationsSidebarHidden={isConversationsSidebarHidden}
        activeProfileType={activeProfileType}
        setIsConversationsSidebarHidden={setIsConversationsSidebarHidden}
        onNewAction={() => selectedCategory === 'direct' ? modals.openModal('showNewDMModal') : modals.openModal('showCreateGroupModal')}
        onInvitationsClick={() => modals.openModal('showInvitationsModal')}
        onProfileTypeChange={setActiveProfileType}
      />

      {/* Conversations list */}
      <ConversationsList
        conversations={
          selectedCategory === 'direct' 
            ? profileConversations.conversations.map(pc => ({
                id: pc.other_user.user_id,
                name: pc.other_user.username,
                type: 'direct' as const,
                last_message: pc.latest_message?.content,
                last_activity: pc.latest_message?.timestamp || pc.created_at.toString(),
                unread_count: 0,
                user_id: pc.other_user.user_id,
              }))
            : conversations.conversations
        }
        selectedCategory={selectedCategory}
        selectedConversation={selectedConversation}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSelectConversation={selectConversation}
        onConversationContextMenu={handleConversationContextMenu}
        isMobile={isMobile}
        isConversationsSidebarHidden={isConversationsSidebarHidden}
        setIsConversationsSidebarHidden={setIsConversationsSidebarHidden}
        setIsSidebarVisible={setIsSidebarVisible}
        // SSE status props
        isConnected={isConnected}
        connectionError={connectionError}
        sessionToken={sessionToken}
        currentUser={currentUser}
        // Profile switcher props
        activeProfileType={activeProfileType}
        setActiveProfileType={setActiveProfileType}
      />

      {/* Chat area */}
      <ChatArea
        selectedConversation={selectedConversation}
        selectedConversationType={selectedConversationType}
        selectedChannel={selectedChannel}
        setSelectedChannel={setSelectedChannel}
        selectedConversationData={selectedConversationData}
        groupChannels={groupManagement.groupChannels}
        messages={
          selectedConversationType === 'direct' && selectedCategory === 'direct'
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
        isMobile={isMobile}
        isConversationsSidebarHidden={isConversationsSidebarHidden}
        setIsConversationsSidebarHidden={setIsConversationsSidebarHidden}
        setIsSidebarVisible={setIsSidebarVisible}
        onMembersClick={() => modals.openModal('showMembersModal')}
        onInviteClick={() => modals.openModal('showInviteModal')}
        onBannedUsersClick={() => {
          groupManagement.fetchBannedUsers(selectedConversation);
          modals.openModal('showBannedUsersModal');
        }}
        onCreateChannelClick={() => modals.openModal('showCreateChannelModal')}
        onChannelContextMenu={handleChannelContextMenu}
        canManageMembers={canManageMembers}
        typingUsers={typingIndicator.typingUsers}
        onTyping={typingIndicator.emitTyping}
        sessionToken={sessionToken}
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
              // Check if we're in profile mode and should use profile-specific deletion
              if (selectedCategory === 'direct') {
                // Use profile conversations delete which sends proper profile types
                return await profileConversations.deleteConversation(id);
              } else {
                // Use regular conversations delete for legacy/mixed conversations
                const conversation = conversations.conversations.find(c => c.id === id);
                if (conversation) {
                  await conversations.deleteConversation(conversation);
                  return true;
                }
                return false;
              }
            },
            leaveGroup: async (id: string): Promise<boolean> => {
              try {
                const res = await fetch('/api/groups/leave', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ group_id: id })
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
            deleteMessage: selectedCategory === 'direct' && selectedConversationType === 'direct' 
              ? profileMessages.deleteMessage 
              : messages.deleteMessage 
          }}
          currentUser={currentUser}
          selectedChannel={selectedChannel}
          setSelectedChannel={setSelectedChannel}
        />
      )}

      {/* Modals */}
      {modals.modals.showCreateGroupModal && (
        <CreateGroupModal
          onClose={() => modals.closeModal('showCreateGroupModal')}
          currentUser={currentUser}
          onSuccess={() => {
            conversations.fetchConversations();
            modals.closeModal('showCreateGroupModal');
          }}
        />
      )}

      {modals.modals.showNewDMModal && (
        <StartConversationModal
          isOpen={true}
          onClose={() => modals.closeModal('showNewDMModal')}
          onSuccess={(conversation) => {
            selectConversation(conversation);
            // Refresh both conversation types
            conversations.fetchConversations();
            profileConversations.fetchConversations();
            modals.closeModal('showNewDMModal');
          }}
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
    </div>
  );
};

export default UnifiedMessages;