import React, { useEffect, useState, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers,
  faUser,
  faSearch,
  faPaperPlane,
  faUserPlus,
  faTimes,
  faLock,
  faBell,
  faHashtag,
  faAt,
  faCheck,
  faCheckDouble,
  faHome,
  faEnvelope,
  faBook,
  faSignOutAlt,
  faBars,
  faKey
} from '@fortawesome/free-solid-svg-icons';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ProfileAvatar from './ProfileAvatar';

// Utility function to detect YouTube URLs
const detectYouTubeURL = (text: string): string | null => {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = text.match(youtubeRegex);
  return match ? match[1] : null;
};

// YouTube embed component
const YouTubeEmbed: React.FC<{ videoId: string; content: string }> = ({ videoId, content }) => {
  const [showEmbed, setShowEmbed] = useState(false);

  return (
    <div className="space-y-2">
      <p className="leading-relaxed">{content}</p>
      {!showEmbed ? (
        <div 
          className="bg-black/40 border border-gray-600 rounded-lg p-3 cursor-pointer hover:bg-black/60 transition-colors"
          onClick={() => setShowEmbed(true)}
        >
          <div className="flex items-center space-x-3">
            <Image 
              src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
              alt="YouTube video thumbnail"
              width={80}
              height={60}
              className="object-cover rounded"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">YouTube</div>
              </div>
              <p className="text-white text-sm">Click to play video</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative bg-black rounded-lg overflow-hidden">
          <iframe
            width="400"
            height="225"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full aspect-video"
          ></iframe>
          <button
            onClick={() => setShowEmbed(false)}
            className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded hover:bg-black/90 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="text-xs" />
          </button>
        </div>
      )}
    </div>
  );
};

// Enhanced message content renderer
const MessageContent: React.FC<{ content: string }> = ({ content }) => {
  const youtubeVideoId = detectYouTubeURL(content);
  
  if (youtubeVideoId) {
    return <YouTubeEmbed videoId={youtubeVideoId} content={content} />;
  }
  
  return <p className="leading-relaxed">{content}</p>;
};

// Interfaces
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

interface User {
  user_id: string;
  username: string;
  // Add other user properties if needed
}

interface PrivateConversationFromAPI {
  id: string; // This is the conversation ID
  created_at: string;
  updated_at: string;
  latest_message?: {
    content: string;
    timestamp: string;
  };
  other_user: User; // This is the other participant
  current_user_id: string; // ID of the user making the request
}

interface Group {
  _id?: string;
  group_id: string;
  name: string;
  description: string;
  creator_id: string;
  creation_date: string;
  is_private: boolean;
  members_count: number;
  topic: string;
  status: string;
  last_activity: string;
  user_role?: string;
}

interface GroupMember {
  user_id: string;
  username: string;
  role: string;
  join_date: string;
}

interface GroupInvitation {
  invitation_id: string;
  group_id: string;
  group_name: string;
  inviter_id: string;
  inviter_username: string;
  invited_user_id: string;
  created_at: string;
  status: string;
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
  user_id?: string; // For direct messages, this is the other user's ID
}

type ContextMenuExtra = Conversation | PrivateMessage | GroupMessage | undefined;

const UnifiedMessages = () => {
  // State management
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string>('');
  const [selectedConversationType, setSelectedConversationType] = useState<'direct' | 'group'>('direct');
  const [selectedCategory, setSelectedCategory] = useState<'direct' | 'groups'>('direct');
  const [messages, setMessages] = useState<(PrivateMessage | GroupMessage)[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState<{ user_id: string; username: string; is_admin?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  
  // Sidebar state for mobile responsiveness
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isConversationsSidebarHidden, setIsConversationsSidebarHidden] = useState(false);
  
  // Channel-related state
  const [groupChannels, setGroupChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [createChannelForm, setCreateChannelForm] = useState({
    name: '',
    description: ''
  });
  
  // Modal states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showNewDMModal, setShowNewDMModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInvitationsModal, setShowInvitationsModal] = useState(false);
  
  // Form states
  const [createGroupForm, setCreateGroupForm] = useState({
    name: '',
    description: '',
    topic: '',
    is_private: false
  });
  const [selectedUserForDM, setSelectedUserForDM] = useState('');
  const [selectedUserToInvite, setSelectedUserToInvite] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [inviteLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Remove localStorage-based deleted conversations - now handled by database
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'conversation' | 'message' | 'member' | 'channel';
    id: string;
    extra?: ContextMenuExtra | GroupMember | Channel;
  } | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch current user
  useEffect(() => {
    fetch('/api/session')
      .then(res => res.json())
      .then(data => {
        if (data.valid && data.user) {
          setCurrentUser({ user_id: data.user.user_id, username: data.user.username, is_admin: data.user.is_admin });
        }
      });
  }, []);

  // Fetch all users for DMs and invitations
  useEffect(() => {
    if (currentUser) {
      fetch('/api/users/list')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const filteredUsers = data.users.filter((u: User) => u.user_id !== currentUser.user_id);
            setUsers(filteredUsers);
          }
        });
    }
  }, [currentUser]);

  // Fetch conversations (combination of DMs and groups)
  const fetchConversations = useCallback(async () => {
    if (!currentUser) return;

    try {
      console.log('Fetching conversations for user:', currentUser.user_id);
      
      // Fetch DMs using the private conversations API
      const dmsRes = await fetch('/api/private-conversations');
      const dmsData = await dmsRes.json();
      console.log('Private conversations API response:', dmsData);
      
      // Fetch groups
      const groupsRes = await fetch('/api/groups/list');
      const groupsData = await groupsRes.json();
      console.log('Groups API response:', groupsData);

      const dmConversations: Conversation[] = [];
      const groupConversations: Conversation[] = [];

      if (dmsData.success && Array.isArray(dmsData.conversations)) {
        console.log('Processing', dmsData.conversations.length, 'private conversations');
        dmsData.conversations.forEach((conv: PrivateConversationFromAPI) => { // Use the new interface here
          if (conv.other_user) {
            const dmConvo: Conversation = { // Ensure this matches the Conversation interface
              id: conv.other_user.user_id, // Use other_user.user_id as the ID for the conversation entry
              name: conv.other_user.username,
              type: 'direct' as const,
              user_id: conv.other_user.user_id, // Store other_user.user_id for avatar
              last_message: conv.latest_message?.content,
              last_activity: conv.latest_message?.timestamp || conv.created_at,
              unread_count: 0 // Placeholder for unread count
            };
            console.log('Adding DM conversation:', dmConvo);
            dmConversations.push(dmConvo);
          }
        });
      } else {
        console.log('No private conversations found or API error:', dmsData);
      }

      if (groupsData.success && groupsData.groups) {
        console.log('Processing', groupsData.groups.length, 'groups');
        groupsData.groups.forEach((group: Group) => {
          console.log('Adding group conversation:', group);
          groupConversations.push({
            id: group.group_id,
            name: group.name,
            type: 'group',
            is_private: group.is_private,
            last_activity: group.last_activity,
            members_count: group.members_count,
            unread_count: 0 // TODO: Implement unread count
          });
        });
      } else {
        console.log('No groups found or API error:', groupsData);
      }

      // Sort by last activity
      const allConversations = [...dmConversations, ...groupConversations].sort((a, b) => 
        new Date(b.last_activity || 0).getTime() - new Date(a.last_activity || 0).getTime()
      );
      
      console.log('Final conversation list:', allConversations);
      console.log('Setting conversations in state...');
      
      // No need to filter out deleted DMs - the API now only returns visible conversations
      setConversations(allConversations);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Failed to load conversations');
      setLoading(false);
    }
  }, [currentUser]);

  // Fetch invitations
  const fetchInvitations = useCallback(async () => {
    try {
      const res = await fetch('/api/invitations');
      const data = await res.json();
      if (data.success) {
        setInvitations(data.invitations);
      }
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    }
  }, []);

  // Fetch channels for a group
  const fetchChannels = useCallback(async (groupId: string) => {
    try {
      console.log('Fetching channels for group:', groupId);
      const res = await fetch(`/api/groups/${groupId}/channels`);
      const data = await res.json();
      if (data.success) {
        console.log('Channels fetched:', data.channels);
        setGroupChannels(data.channels);
        
        // Always select the default channel when fetching channels for a new group
        if (data.channels.length > 0) {
          const defaultChannel = data.channels.find((ch: Channel) => ch.is_default) || data.channels[0];
          console.log('Auto-selecting default channel:', defaultChannel.channel_id);
          setSelectedChannel(defaultChannel.channel_id);
          // The useEffect for channel changes will handle fetching messages
        }
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    }
  }, []); // Remove selectedChannel dependency to prevent race conditions

  // Create a new channel
  const createChannel = async (): Promise<void> => {
    if (!selectedConversation || !createChannelForm.name.trim()) return;

    try {
      console.log('Creating channel with data:', createChannelForm);
      const res = await fetch(`/api/groups/${selectedConversation}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createChannelForm)
      });

      const data = await res.json();
      console.log('Channel creation response:', data);

      if (data.success) {
        console.log('Channel created successfully, fetching channels...');
        await fetchChannels(selectedConversation);
        console.log('Channels fetched after channel creation');
        
        // Auto-select the newly created channel
        if (data.channel_id) {
          console.log('Auto-selecting new channel:', data.channel_id);
          setSelectedChannel(data.channel_id);
          // Clear messages and fetch for the new channel
          setMessages([]);
          await fetchChannelMessages(selectedConversation, data.channel_id);
        }
        
        setShowCreateChannelModal(false);
        setCreateChannelForm({ name: '', description: '' });
      } else {
        console.error('Channel creation failed:', data);
        setError(data.error || 'Failed to create channel');
      }
    } catch (err) {
      console.error('Error creating channel:', err);
      setError('Failed to create channel');
    }
  };

  useEffect(() => {
    if (currentUser && users.length > 0) {
      fetchConversations();
      fetchInvitations();
    }
  }, [currentUser, users, fetchConversations, fetchInvitations]);

  // Fetch channels when a group conversation is selected
  useEffect(() => {
    if (selectedConversation && selectedConversationType === 'group') {
      fetchChannels(selectedConversation);
    } else {
      setGroupChannels([]);
      setSelectedChannel('');
      // Clear messages when switching away from groups
      if (selectedConversationType !== 'group') {
        setMessages([]);
      }
    }
  }, [selectedConversation, selectedConversationType, fetchChannels]);

  // Fetch messages for selected conversation or channel
  const fetchMessages = useCallback(async (conversationId: string, type: 'direct' | 'group') => {
    try {
      let url: string;
      if (type === 'direct') {
        url = `/api/messages`;
      } else {
        // For group messages, check if we have a selected channel
        if (selectedChannel && groupChannels.length > 0) {
          // Use channel-specific endpoint
          url = `/api/groups/${conversationId}/channels/${selectedChannel}/messages`;
        } else {
          // Use default channel endpoint for backward compatibility
          url = `/api/groups/${conversationId}/messages`;
        }
      }

      console.log('Fetching messages from:', url);
      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        if (type === 'direct' && data.pms) {
          const filteredMessages = data.pms.filter((msg: PrivateMessage) => 
            (msg.sender_id === conversationId && msg.receiver_id === currentUser?.user_id) ||
            (msg.sender_id === currentUser?.user_id && msg.receiver_id === conversationId)
          );
          // Sort ascending by timestamp
          filteredMessages.sort((a: PrivateMessage, b: PrivateMessage) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setMessages(filteredMessages);
        } else if (type === 'group' && data.messages) {
          // Sort ascending by timestamp
          (data.messages as GroupMessage[]).sort((a: GroupMessage, b: GroupMessage) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setMessages(data.messages);
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, [currentUser?.user_id, selectedChannel, groupChannels.length]);

  // Fetch messages for selected channel
  const fetchChannelMessages = useCallback(async (groupId: string, channelId: string) => {
    try {
      const url = `/api/groups/${groupId}/channels/${channelId}/messages`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.success && data.messages) {
        // Sort ascending by timestamp
        (data.messages as GroupMessage[]).sort((a: GroupMessage, b: GroupMessage) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Failed to fetch channel messages:', err);
    }
  }, []);

  // Fetch messages when channel changes
  useEffect(() => {
    if (selectedConversation && selectedConversationType === 'group' && selectedChannel) {
      console.log('Channel changed, fetching messages for channel:', selectedChannel);
      fetchChannelMessages(selectedConversation, selectedChannel);
    } else if (selectedConversation && selectedConversationType === 'group' && groupChannels.length > 0 && !selectedChannel) {
      // Auto-select default channel if none is selected
      const defaultChannel = groupChannels.find(ch => ch.is_default) || groupChannels[0];
      if (defaultChannel) {
        console.log('Auto-selecting default channel:', defaultChannel.channel_id);
        setSelectedChannel(defaultChannel.channel_id);
      }
    }
  }, [selectedChannel, selectedConversation, selectedConversationType, groupChannels, fetchChannelMessages]);

  // Fetch group members
  const fetchGroupMembers = useCallback(async (groupId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/members`);
      const data = await res.json();
      if (data.success) {
        setGroupMembers(data.members);
      }
    } catch (err) {
      console.error('Failed to fetch group members:', err);
    }
  }, []);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;

    try {
      let url: string;
      let body: Record<string, unknown>;

      if (selectedConversationType === 'direct') {
        url = '/api/messages';
        body = {
          receiver_id: selectedConversation,
          content: newMessage,
          attachments: []
        };
      } else {
        // For group messages, send to specific channel if selected
        if (selectedChannel) {
          url = `/api/groups/${selectedConversation}/channels/${selectedChannel}/messages`;
        } else {
          // Fallback to default channel endpoint
          url = `/api/groups/${selectedConversation}/messages`;
        }
        body = {
          content: newMessage,
          attachments: []
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success) {
        setNewMessage('');
        console.log('Message sent successfully, refreshing messages...');
        
        // Refresh messages based on current context
        if (selectedConversationType === 'group' && selectedChannel) {
          console.log('Refreshing channel messages for channel:', selectedChannel);
          await fetchChannelMessages(selectedConversation, selectedChannel);
        } else {
          console.log('Refreshing default group/DM messages');
          await fetchMessages(selectedConversation, selectedConversationType);
        }
        
        // Refresh conversation list to update last activity
        fetchConversations();
      } else {
        console.error('Failed to send message:', data);
        setError(data.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Handle conversation selection
  const selectConversation = useCallback((conversation: Conversation) => {
    console.log('Selecting conversation:', conversation);
    setSelectedConversation(conversation.id);
    setSelectedConversationType(conversation.type);
    
    // Clear messages immediately for better UX
    setMessages([]);
    
    if (conversation.type === 'group') {
      // Reset channel state first to prevent race conditions
      setSelectedChannel('');
      setGroupChannels([]);
      
      // Fetch group members and channels
      fetchGroupMembers(conversation.id);
      // fetchChannels will be called by the useEffect that watches selectedConversation
    } else {
      // Clear group-related state when switching to direct messages
      setSelectedChannel('');
      setGroupChannels([]);
      setGroupMembers([]);
      
      // For direct messages, fetch immediately
      fetchMessages(conversation.id, conversation.type);
    }
  }, [fetchGroupMembers, fetchMessages]);

  const searchParams = useSearchParams();
  // Auto-select direct message based on query param
  useEffect(() => {
    const dmUserId = searchParams.get('user');
    if (dmUserId && users.length > 0 && conversations.length > 0) {
      console.log('Trying to auto-select conversation for user:', dmUserId);
      console.log('Available conversations:', conversations.map(c => ({ id: c.id, name: c.name, type: c.type })));
      
      const convo = conversations.find(c => c.id === dmUserId && c.type === 'direct');
      if (convo) {
        console.log('Found conversation, selecting:', convo);
        selectConversation(convo);
      } else {
        console.log(`Conversation with user ${dmUserId} not found in database`);
        console.log('Available direct conversations:', conversations.filter(c => c.type === 'direct'));
      }
    } else {
      if (dmUserId) {
        console.log('Auto-select conditions not met:', {
          dmUserId,
          usersLoaded: users.length > 0,
          conversationsLoaded: conversations.length > 0,
          conversationsCount: conversations.length
        });
      }
    }
  }, [searchParams, conversations, users, selectConversation]);

  // Create new group
  const createGroup = async () => {
    try {
      console.log('Creating group with data:', createGroupForm);
      const res = await fetch('/api/groups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createGroupForm)
      });

      const data = await res.json();
      console.log('Group creation response:', data);
      if (data.success) {
        setShowCreateGroupModal(false);
        setCreateGroupForm({ name: '', description: '', topic: '', is_private: false });
        console.log('Group created successfully, fetching conversations...');
        await fetchConversations();
        console.log('Conversations fetched after group creation');
      } else {
        console.error('Group creation failed:', data);
      }
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  // Start new DM
  const startNewDM = async () => {
    if (!selectedUserForDM) return;
    
    try {
      // Create conversation in database first, like other components do
      const res = await fetch('/api/private-conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          other_user_id: selectedUserForDM
        })
      });
      
      const data = await res.json();
      if (data.success) {
        // Refresh conversations to include the new one
        await fetchConversations();
        
        // Now select the conversation by user ID
        const targetUser = users.find(u => u.user_id === selectedUserForDM);
        if (targetUser) {
          const conversation: Conversation = {
            id: selectedUserForDM,
            name: targetUser.username,
            type: 'direct'
          };
          selectConversation(conversation);
        }
        
        setShowNewDMModal(false);
        setSelectedUserForDM('');
      } else {
        setError('Failed to create conversation: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
      setError('Failed to create conversation. Please try again.');
    }
  };

  // Auto-refresh
  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (selectedConversation && currentUser) {
      // Set up new interval
      intervalRef.current = setInterval(async () => {
        try {
          // Directly call the API without using the callback functions to avoid dependency issues
          if (selectedConversationType === 'group' && selectedChannel) {
            console.log('Auto-refreshing channel messages');
            const url = `/api/groups/${selectedConversation}/channels/${selectedChannel}/messages`;
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.success && data.messages) {
              // Sort ascending by timestamp
              (data.messages as GroupMessage[]).sort((a: GroupMessage, b: GroupMessage) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
              setMessages(data.messages);
            }
          } else if (selectedConversationType === 'direct') {
            console.log('Auto-refreshing direct messages');
            const res = await fetch('/api/messages');
            const data = await res.json();
            
            if (data.success && data.pms) {
              const filteredMessages = data.pms.filter((msg: PrivateMessage) => 
                (msg.sender_id === selectedConversation && msg.receiver_id === currentUser.user_id) ||
                (msg.sender_id === currentUser.user_id && msg.receiver_id === selectedConversation)
              );
              // Sort ascending by timestamp
              filteredMessages.sort((a: PrivateMessage, b: PrivateMessage) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
              setMessages(filteredMessages);
            }
          }
        } catch (err) {
          console.error('Auto-refresh failed:', err);
        }
      }, 5000); // 5 second interval

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [selectedConversation, selectedConversationType, selectedChannel, currentUser]); // Only depend on primitive values

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mark messages as read when viewing a conversation
  useEffect(() => {
    if (!selectedConversation || !currentUser) return;
    
    if (selectedConversationType === 'direct') {
      // Find if there are any unread messages from selectedConversation (sender) to currentUser (receiver)
      const hasUnread = messages
        .filter((msg): msg is PrivateMessage => (msg as PrivateMessage).receiver_id !== undefined && (msg as PrivateMessage).read !== undefined)
        .some(
          msg => msg.sender_id === selectedConversation && msg.receiver_id === currentUser.user_id && !msg.read
        );
      
      if (hasUnread) {
        fetch('/api/messages', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender_id: selectedConversation }),
        }).then(() => {
          // Refresh messages to show updated read status
          fetchMessages(selectedConversation, selectedConversationType);
        });
      }
    } else if (selectedConversationType === 'group') {
      // Find if there are any unread group messages for the current user
      const hasUnread = messages
        .filter((msg): msg is GroupMessage => (msg as GroupMessage).group_id !== undefined)
        .some(msg => !msg.current_user_read && msg.sender_id !== currentUser.user_id);
      
      if (hasUnread) {
        fetch(`/api/groups/${selectedConversation}/messages/read`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        }).then(() => {
          // Refresh messages to show updated read status
          fetchMessages(selectedConversation, selectedConversationType);
        });
      }
    }
  }, [selectedConversation, selectedConversationType, currentUser, messages, fetchMessages]);

  // Fetch available users for invitation
  const fetchAvailableUsers = async () => {
    if (!selectedConversation) return;

    try {
      const res = await fetch(`/api/users/available?group_id=${selectedConversation}`);
      const data = await res.json();
      if (data.success) {
        setAvailableUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to fetch available users:', err);
    }
  };

  // Respond to invitation
  const respondToInvitation = async (invitationId: string, action: 'accept' | 'decline') => {
    try {
      const res = await fetch(`/api/invitations/${invitationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const data = await res.json();
      if (data.success) {
        fetchInvitations();
        fetchConversations();
        if (action === 'accept') {
          alert('Invitation accepted! You have joined the group.');
        }
      } else {
        alert(data.message || 'Failed to respond to invitation');
      }
    } catch (err) {
      console.error('Failed to respond to invitation:', err);
      alert('Failed to respond to invitation');
    }
  };

  const selectedConversationData = conversations.find(c => c.id === selectedConversation);

  // Handle right-click on conversation
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

  // Handle right-click on message
  const handleMessageContextMenu = (e: React.MouseEvent, message: PrivateMessage | GroupMessage) => {
    e.preventDefault();
    // Only allow delete if user is sender
    if (message.sender_id !== currentUser?.user_id) return;
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'message',
      id: (message as PrivateMessage)._id || (message as GroupMessage).message_id,
      extra: message
    });
  };

  // Delete conversation (DM or group)
  const deleteConversation = async (conv: Conversation) => {
    // Clear the selected conversation first if it matches the deleted one
    if (selectedConversation === conv.id) {
      setSelectedConversation('');
      setSelectedConversationType('direct');
      setMessages([]);
    }
    
    if (conv.type === 'direct') {
      await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ other_user_id: conv.id })
      });
      
      // Immediately remove the conversation from local state for better UX
      setConversations(prev => prev.filter(c => !(c.id === conv.id && c.type === 'direct')));
      
      // No need to manage deletedDMConversations set - database handles this now
    } else if (conv.type === 'group') {
      // If user is group creator, delete group; otherwise, leave group
      if (groupMembers.find(m => m.user_id === currentUser?.user_id && (m.role === 'owner' || m.role === 'admin'))) {
        await fetch(`/api/groups/${conv.id}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/groups/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: conv.id })
        });
      }
      // Immediately remove the group conversation from local state
      setConversations(prev => prev.filter(c => !(c.id === conv.id && c.type === 'group')));
    }
    
    setContextMenu(null);
  };

  // Delete message
  const deleteMessage = async (msg: PrivateMessage | GroupMessage) => {
    if (selectedConversationType === 'direct') {
      await fetch('/api/messages', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: (msg as PrivateMessage)._id })
      });
    } else {
      await fetch(`/api/groups/${selectedConversation}/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: (msg as GroupMessage).message_id })
      });
    }
    setContextMenu(null);
    fetchMessages(selectedConversation, selectedConversationType);
  };

  // Hide context menu on click elsewhere
  useEffect(() => {
    const hideMenu = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', hideMenu);
      return () => window.removeEventListener('click', hideMenu);
    }
  }, [contextMenu]);

  // Invite user to group
  const inviteUserToGroup = async () => {
    if (!selectedUserToInvite || !selectedConversation) return;
    try {
      const res = await fetch(`/api/groups/${selectedConversation}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invited_user_id: selectedUserToInvite })
      });
      const data = await res.json();
      if (data.success) {
        setShowInviteModal(false);
        setSelectedUserToInvite('');
      } else {
        setError(data.error || 'Failed to send invitation');
      }
    } catch {
      setError('Failed to send invitation');
    }
  };

  // Remove member from group
  const removeMember = async (memberId: string) => {
    if (!selectedConversation) return;
    try {
      const res = await fetch(`/api/groups/${selectedConversation}/members/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: memberId })
      });
      const data = await res.json();
      if (data.success) {
        fetchGroupMembers(selectedConversation);
        alert('Member removed successfully');
      } else {
        alert(data.error || 'Failed to remove member');
      }
    } catch {
      alert('Failed to remove member');
    }
  };

  // Ban member from group
  const banMember = async (memberId: string) => {
    if (!selectedConversation) return;
    const reason = prompt('Enter reason for ban (optional):');
    if (reason === null) return; // User cancelled
    
    try {
      const res = await fetch(`/api/groups/${selectedConversation}/members/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: memberId, reason })
      });
      const data = await res.json();
      if (data.success) {
        fetchGroupMembers(selectedConversation);
        alert('Member banned successfully');
      } else {
        alert(data.error || 'Failed to ban member');
      }
    } catch {
      alert('Failed to ban member');
    }
  };

  // Handle right-click on member
  const handleMemberContextMenu = (e: React.MouseEvent, member: GroupMember) => {
    e.preventDefault();
    // Only allow admin actions if current user is admin and target is not creator
    const currentUserMember = groupMembers.find(m => m.user_id === currentUser?.user_id);
    const isCurrentUserAdmin = currentUserMember && (currentUserMember.role === 'owner' || currentUserMember.role === 'admin');
    const isTargetCreator = member.role === 'owner' || member.role === 'admin';
    
    if (!isCurrentUserAdmin || isTargetCreator || member.user_id === currentUser?.user_id) return;
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'member',
      id: member.user_id,
      extra: member
    });
  };

  // Handle right-click on channel
  const handleChannelContextMenu = (e: React.MouseEvent, channel: Channel) => {
    e.preventDefault();
    // Only allow channel deletion for group owners and prevent deletion of default channels
    const currentUserMember = groupMembers.find(m => m.user_id === currentUser?.user_id);
    const isOwner = currentUserMember && currentUserMember.role === 'owner';
    
    if (!isOwner || channel.is_default) return;
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'channel',
      id: channel.channel_id,
      extra: channel
    });
  };

  // Delete channel
  const deleteChannel = async (channelId: string) => {
    if (!selectedConversation) return;
    
    if (!window.confirm('Are you sure you want to delete this channel? This will delete all messages in the channel and cannot be undone.')) {
      return;
    }
    
    try {
      const res = await fetch(`/api/groups/${selectedConversation}/channels/${channelId}`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      
      if (data.success) {
        // If the deleted channel was selected, switch to default channel
        if (selectedChannel === channelId) {
          const defaultChannel = groupChannels.find(ch => ch.is_default);
          if (defaultChannel) {
            setSelectedChannel(defaultChannel.channel_id);
          } else if (groupChannels.length > 1) {
            // Find the first non-deleted channel
            const remainingChannel = groupChannels.find(ch => ch.channel_id !== channelId);
            if (remainingChannel) {
              setSelectedChannel(remainingChannel.channel_id);
            }
          }
        }
        
        // Refresh channels list
        await fetchChannels(selectedConversation);
        
        alert('Channel deleted successfully');
      } else {
        alert(data.error || 'Failed to delete channel');
      }
    } catch (error) {
      console.error('Error deleting channel:', error);
      alert('Failed to delete channel');
    }
  };

  // Handle window resize for mobile responsiveness
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Call once on mount

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-white">
        <div className="text-xl">Loading conversations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="text-xl text-red-400 mb-4">Error loading conversations</div>
          <div className="text-gray-400">{error}</div>
          <button 
            onClick={() => {
              setError('');
              setLoading(true);
              fetchConversations();
            }}
            className="mt-4 bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-black text-white h-full overflow-hidden relative">
      {/* Mobile Overlay */}
      {isMobile && isSidebarVisible && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsSidebarVisible(false)}
        />
      )}

      {/* Left Sidebar - Enhanced Discord-style with Navigation - ALWAYS VISIBLE */}
      <div className={`${isMobile ? 'fixed left-0 top-0 z-50 h-full' : ''} w-16 bg-black flex flex-col border-r border-white h-full transition-transform duration-300 ${
        isMobile ? (isSidebarVisible ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
      }`}>
        <div className="p-2 space-y-2">
          {/* Home Navigation */}
          <div 
            className="w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => window.location.href = '/'}
            title="Home"
          >
            <FontAwesomeIcon icon={faHome} />
          </div>
          
          {/* Profile Navigation */}
          <div 
            className="w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => window.location.href = '/profile'}
            title="Profile"
          >
            <FontAwesomeIcon icon={faUser} />
          </div>
          
          {/* Search Navigation */}
          <div 
            className="w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => window.location.href = '/search'}
            title="Search Users"
          >
            <FontAwesomeIcon icon={faSearch} />
          </div>
          
          {/* Catalogs Navigation */}
          <div 
            className="w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => window.location.href = '/catalogs'}
            title="My Catalogs"
          >
            <FontAwesomeIcon icon={faBook} />
          </div>
          
          {/* First Separator */}
          <div className="w-8 h-px bg-white mx-auto"></div>
          
          {/* Direct Messages Category */}
          <div 
            className={`w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
              selectedCategory === 'direct' ? 'bg-white text-black' : ''
            }`}
            onClick={() => setSelectedCategory('direct')}
            title="Direct Messages"
          >
            <FontAwesomeIcon icon={faEnvelope} />
          </div>
          
          {/* Groups Category */}
          <div 
            className={`w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
              selectedCategory === 'groups' ? 'bg-white text-black' : ''
            }`}
            onClick={() => setSelectedCategory('groups')}
            title="Groups"
          >
            <FontAwesomeIcon icon={faUsers} />
          </div>
          
          {/* Second Separator */}
          <div className="w-8 h-px bg-white mx-auto"></div>
          
          {/* Actions */}
          <div 
            className="w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => selectedCategory === 'direct' ? setShowNewDMModal(true) : setShowCreateGroupModal(true)}
            title={selectedCategory === 'direct' ? 'New Direct Message' : 'Create Group'}
          >
            <FontAwesomeIcon icon={faUserPlus} />
          </div>
          
          {/* Invitations */}
          <div 
            className="relative w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => {
              setShowInvitationsModal(true);
              fetchInvitations();
            }}
            title="Invitations"
          >
            <FontAwesomeIcon icon={faBell} />
            {invitations.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {invitations.length}
              </span>
            )}
          </div>

          {/* Admin Dashboard - New Button */}
          {currentUser?.is_admin && (
            <div 
              className="w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
              onClick={() => window.location.href = '/admindashboard'}
              title="Admin Dashboard"
            >
              <FontAwesomeIcon icon={faKey} />
            </div>
          )}
          
          {/* Mobile Chat Sidebar Toggle */}
          {isMobile && (
            <div 
              className="w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
              onClick={() => setIsConversationsSidebarHidden(!isConversationsSidebarHidden)}
              title={isConversationsSidebarHidden ? "Show Chat Sidebar" : "Hide Chat Sidebar"}
            >
              <FontAwesomeIcon 
                icon={isConversationsSidebarHidden ? faEnvelope : faTimes} 
                className={isConversationsSidebarHidden ? "text-white" : "text-red-400"}
              />
            </div>
          )}
        </div>
        
        {/* Bottom Navigation - Logout */}
        <div className="mt-auto p-2 pb-4">
          <div 
            className="w-12 h-12 bg-red-900 border border-red-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-800 transition-colors"
            onClick={async () => {
              await fetch('/api/logout', { method: 'POST' });
              window.location.href = '/';
            }}
            title="Logout"
          >
            <FontAwesomeIcon icon={faSignOutAlt} className="text-red-300" />
          </div>
        </div>
      </div>

      {/* Middle Sidebar - Conversations List (Discord-style) - CAN BE HIDDEN */}
      {!isConversationsSidebarHidden && (
        <div className={`${isMobile ? 'fixed left-16 top-0 z-40 h-full' : ''} w-60 bg-black flex flex-col border-r border-white h-full transition-transform duration-300 ${
          isMobile ? (isSidebarVisible || !isConversationsSidebarHidden ? 'translate-x-0' : '-translate-x-full') : (isConversationsSidebarHidden ? '-translate-x-full' : 'translate-x-0')
        }`}>
          {/* Category Header */}
          <div className="p-4 border-b border-white">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-lg font-bold flex items-center">
                <FontAwesomeIcon 
                  icon={selectedCategory === 'direct' ? faUser : faUsers} 
                  className="mr-2"
                />
                {selectedCategory === 'direct' ? 'Direct Messages' : 'Groups'}
              </h1>
              <div className="flex items-center space-x-2">
                {/* Conversations Sidebar Toggle Button */}
                <button
                  onClick={() => setIsConversationsSidebarHidden(!isConversationsSidebarHidden)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                  title={isConversationsSidebarHidden ? "Show Conversations" : "Hide Conversations"}
                >
                  <FontAwesomeIcon icon={faBars} className="text-sm" />
                </button>
                {/* Mobile Close Button */}
                {isMobile && (
                  <button
                    onClick={() => setIsConversationsSidebarHidden(true)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                    title="Hide Conversations"
                  >
                    <FontAwesomeIcon icon={faTimes} className="text-sm" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder={`Search ${selectedCategory === 'direct' ? 'conversations' : 'groups'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black text-white border border-white rounded px-3 py-2 pl-8 text-sm focus:outline-none focus:ring-1 focus:ring-white"
              />
              <FontAwesomeIcon 
                icon={faSearch} 
                className="absolute left-2 top-2.5 text-white opacity-60 text-sm"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {(() => {
              console.log('Filtering conversations - selectedCategory:', selectedCategory);
              console.log('Total conversations:', conversations.length);
              console.log('Conversations by type:', {
                direct: conversations.filter(c => c.type === 'direct').length,
                group: conversations.filter(c => c.type === 'group').length
              });
              
              const filteredConversations = conversations
                .filter(conversation => {
                  if (selectedCategory === 'direct') {
                    return conversation.type === 'direct';
                  } else if (selectedCategory === 'groups') {
                    return conversation.type === 'group';
                  }
                  return false;
                })
                .filter(conversation => 
                  conversation.name.toLowerCase().includes(searchQuery.toLowerCase())
                );
              
              console.log('Filtered conversations:', filteredConversations.length);
              console.log('Filtered conversations list:', filteredConversations);
              
              if (filteredConversations.length === 0 && conversations.filter(c => {
                if (selectedCategory === 'direct') {
                  return c.type === 'direct';
                } else if (selectedCategory === 'groups') {
                  return c.type === 'group';
                }
                return false;
              }).length > 0) {
                return (
                  <div className="p-4 text-center text-gray-400">
                    <div className="mb-2 text-sm">No {selectedCategory === 'direct' ? 'conversations' : 'groups'} match &quot;{searchQuery}&quot;</div>
                    <div className="text-xs">
                      {selectedCategory === 'direct' 
                        ? 'Start a new conversation!' 
                        : 'Create or join a group!'
                      }
                    </div>
                  </div>
                );
              }
              
              if (conversations.filter(c => {
                if (selectedCategory === 'direct') {
                  return c.type === 'direct';
                } else if (selectedCategory === 'groups') {
                  return c.type === 'group';
                }
                return false;
              }).length === 0) {
                return (
                  <div className="p-4 text-center text-gray-400">
                    <div className="mb-2 text-sm">No {selectedCategory === 'direct' ? 'conversations' : 'groups'} yet</div>
                    <div className="text-xs">
                      {selectedCategory === 'direct' 
                        ? 'Start a new conversation!' 
                        : 'Create or join a group!'
                      }
                    </div>
                  </div>
                );
              }
              
              return filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  onClick={() => {
                    selectConversation(conversation);
                    if (isMobile) setIsSidebarVisible(false);
                  }}
                  onContextMenu={e => handleConversationContextMenu(e, conversation)}
                  className={`px-3 py-2 mx-2 my-1 rounded cursor-pointer hover:bg-gray-800 transition-colors ${
                    selectedConversation === conversation.id ? 'bg-gray-700' : ''
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    {conversation.type === 'direct' && conversation.user_id ? (
                      <ProfileAvatar userId={conversation.user_id} size={28} />
                    ) : (
                      <div className="w-7 h-7 bg-gray-600 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon 
                          icon={conversation.type === 'group' ? faHashtag : faAt} 
                          className="text-white text-xs"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1">
                        <span className="text-sm font-medium truncate text-white">
                          {conversation.name}
                        </span>
                        {conversation.type === 'group' && conversation.is_private && (
                          <FontAwesomeIcon icon={faLock} className="text-gray-400 text-xs" />
                        )}
                      </div>
                      {conversation.last_message && (
                        <p className="text-xs text-gray-400 truncate">{conversation.last_message}</p>
                      )}
                    </div>
                    {conversation.unread_count && conversation.unread_count > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Main Chat Area - Adjusts based on conversations sidebar visibility */}
      <div className={`flex-1 flex flex-col h-full ${isMobile ? 'ml-0' : (isConversationsSidebarHidden ? 'ml-0' : 'ml-0')}`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-12 px-4 border-b border-white bg-black flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-3">
                {/* Mobile Hamburger Menu Button */}
                {isMobile && (
                  <>
                    <button
                      onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                      title="Toggle Navigation"
                    >
                      <FontAwesomeIcon icon={faBars} className="text-sm" />
                    </button>
                    <button
                      onClick={() => setIsConversationsSidebarHidden(!isConversationsSidebarHidden)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors mr-2"
                      title={isConversationsSidebarHidden ? "Show Conversations" : "Hide Conversations"}
                    >
                      <FontAwesomeIcon icon={faEnvelope} className="text-sm" />
                    </button>
                  </>
                )}
                <div className="flex items-center space-x-2">
                  <FontAwesomeIcon 
                    icon={selectedConversationType === 'group' ? faHashtag : faAt} 
                    className="text-gray-400 text-sm"
                  />
                  <h2 className="font-semibold text-white">
                    {selectedConversationType === 'group' && selectedChannel && groupChannels.length > 0 
                      ? `${selectedConversationData?.name} / #${groupChannels.find(ch => ch.channel_id === selectedChannel)?.name || 'general'}`
                      : selectedConversationData?.name
                    }
                  </h2>
                </div>
                {selectedConversationType === 'group' && selectedConversationData?.members_count && (
                  <div className="h-4 w-px bg-gray-600"></div>
                )}
                {selectedConversationType === 'group' && selectedConversationData?.members_count && (
                  <span className="text-sm text-gray-400">{selectedConversationData.members_count} members</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {/* Full Screen Chat Toggle for Desktop */}
                {!isMobile && (
                  <button
                    onClick={() => setIsConversationsSidebarHidden(!isConversationsSidebarHidden)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                    title={isConversationsSidebarHidden ? "Show Sidebars" : "Hide Sidebars"}
                  >
                    <FontAwesomeIcon icon={faBars} className="text-sm" />
                  </button>
                )}
                {selectedConversationType === 'group' && (
                  <>
                    {groupMembers.some(member => 
                      member.user_id === currentUser?.user_id && 
                      (member.role === 'owner' || member.role === 'admin')
                    ) && (
                      <button
                        onClick={() => setShowCreateChannelModal(true)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                        title="Create Channel"
                      >
                        <FontAwesomeIcon icon={faHashtag} className="text-sm" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowMembersModal(true);
                        fetchGroupMembers(selectedConversation);
                      }}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                      title="View Members"
                    >
                      <FontAwesomeIcon icon={faUsers} className="text-sm" />
                    </button>
                    {selectedConversationData?.is_private && (
                      <button
                        onClick={() => {
                          setShowInviteModal(true);
                          fetchAvailableUsers();
                        }}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                        title="Invite User"
                      >
                        <FontAwesomeIcon icon={faUserPlus} className="text-sm" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Channels Panel for Groups */}
            {selectedConversationType === 'group' && groupChannels.length > 0 && (
              <div className="h-10 px-4 border-b border-gray-700 bg-gray-900 flex items-center space-x-1 overflow-x-auto">
                {groupChannels.map((channel) => (
                  <button
                    key={channel.channel_id}
                    onClick={() => setSelectedChannel(channel.channel_id)}
                    onContextMenu={(e) => handleChannelContextMenu(e, channel)}
                    className={`px-3 py-1 rounded text-sm transition-colors whitespace-nowrap ${
                      selectedChannel === channel.channel_id
                        ? 'bg-white text-black'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <FontAwesomeIcon icon={faHashtag} className="text-xs mr-1" />
                    {channel.name}
                    {channel.is_default && (
                      <span className="ml-1 text-xs opacity-75">(default)</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-black min-h-0">
              <div className="p-4 space-y-3">
                {messages.map((message, index) => {
                  const isOwn = message.sender_id === currentUser?.user_id;
                  const senderName = selectedConversationType === 'group' 
                    ? (message as GroupMessage).sender_username 
                    : isOwn 
                      ? 'You' 
                      : selectedConversationData?.name;

                  const showAvatar = selectedConversationType === 'group' && !isOwn;
                  const prevMessage = index > 0 ? messages[index - 1] : null;
                  const isNewSender = !prevMessage || prevMessage.sender_id !== message.sender_id;
                  const showSenderName = showAvatar && isNewSender;

                  return (
                    <div 
                      key={index} 
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group hover:bg-gray-900/30 -mx-4 px-4 py-1 rounded`}
                      onContextMenu={e => handleMessageContextMenu(e, message)}
                    >
                      {showAvatar ? (
                        <div className="mr-3 mt-0.5">
                          {showSenderName ? (
                            <ProfileAvatar userId={message.sender_id} size={32} />
                          ) : (
                            <div className="w-8 h-8"></div>
                          )}
                        </div>
                      ) : null}
                      
                      <div className={`max-w-md ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                        {showSenderName && (
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-semibold text-white hover:underline cursor-pointer">
                              {senderName}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        
                        <div className={`${
                          isOwn 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-gray-800 text-white border border-gray-700'
                        } rounded-lg px-3 py-2 max-w-full break-words`}>
                          <MessageContent content={message.content} />
                          {!showSenderName && (
                            <div className="flex items-center justify-end space-x-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-xs text-gray-300">
                                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isOwn && (
                                <FontAwesomeIcon
                                  icon={
                                    selectedConversationType === 'direct'
                                      ? ((message as PrivateMessage).read ? faCheckDouble : faCheck)
                                      : ((message as GroupMessage).read_by_others ? faCheckDouble : faCheck)
                                  }
                                  className="text-xs"
                                  style={{
                                    color: selectedConversationType === 'direct'
                                      ? ((message as PrivateMessage).read ? '#4ade80' : '#9ca3af')
                                      : ((message as GroupMessage).read_by_others ? '#4ade80' : '#9ca3af')
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="p-4 bg-black">
              <div className="bg-gray-800 rounded-lg border border-gray-700 flex items-center">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={
                    selectedConversationType === 'group' && selectedChannel && groupChannels.length > 0
                      ? `Message #${groupChannels.find(ch => ch.channel_id === selectedChannel)?.name || 'general'}`
                      : `Message ${selectedConversationType === 'group' ? '#' : '@'}${selectedConversationData?.name}`
                  }
                  className="flex-1 bg-transparent text-white px-4 py-3 focus:outline-none placeholder-gray-400"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="p-2 mr-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <FontAwesomeIcon icon={faPaperPlane} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-black text-center px-8">
            {/* Show Conversations Sidebar Toggle Button when hidden */}
            {isConversationsSidebarHidden && !isMobile && (
              <button
                onClick={() => setIsConversationsSidebarHidden(false)}
                className="fixed top-4 left-20 z-30 p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="Show Conversations"
              >
                <FontAwesomeIcon icon={faBars} className="text-lg" />
              </button>
            )}
            {/* Mobile Hamburger Menu Button for Empty State */}
            {isMobile && (
              <button
                onClick={() => setIsSidebarVisible(true)}
                className="fixed top-4 left-4 z-30 p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                title="Open Sidebar"
              >
                <FontAwesomeIcon icon={faBars} className="text-lg" />
              </button>
            )}
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <FontAwesomeIcon 
                icon={selectedCategory === 'direct' ? faUser : faUsers} 
                className="text-gray-400 text-2xl"
              />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-white">
              {selectedCategory === 'direct' ? 'No Direct Message Selected' : 'No Group Selected'}
            </h2>
            <p className="text-gray-400 mb-6 max-w-md">
              {selectedCategory === 'direct' 
                ? 'Choose a conversation from the sidebar to start messaging with friends.'
                : 'Select a group from the sidebar to see what your community is talking about.'
              }
            </p>
            <button
              onClick={() => selectedCategory === 'direct' ? setShowNewDMModal(true) : setShowCreateGroupModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {selectedCategory === 'direct' ? 'Start New Conversation' : 'Create Group'}
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'conversation' && (
            <button
              onClick={() => deleteConversation(contextMenu.extra as Conversation)}
              className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-700 transition-colors"
            >
              Delete Conversation
            </button>
          )}
          {contextMenu.type === 'message' && (
            <button
              onClick={() => deleteMessage(contextMenu.extra as PrivateMessage | GroupMessage)}
              className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-700 transition-colors"
            >
              Delete Message
            </button>
          )}
          {contextMenu.type === 'member' && (
            <>
              <button
                onClick={() => removeMember(contextMenu.id)}
                className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-700 transition-colors"
              >
                Remove Member
              </button>
              <button
                onClick={() => banMember(contextMenu.id)}
                className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-700 transition-colors"
              >
                Ban Member
              </button>
            </>
          )}
          {contextMenu.type === 'channel' && (
            <button
              onClick={() => deleteChannel(contextMenu.id)}
              className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-700 transition-colors"
            >
              Delete Channel
            </button>
          )}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black border border-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4 text-white">Create New Group</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Group Name"
                value={createGroupForm.name}
                onChange={(e) => setCreateGroupForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-black text-white border border-white rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
              />
              <input
                type="text"
                placeholder="Description"
                value={createGroupForm.description}
                onChange={(e) => setCreateGroupForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full bg-black text-white border border-white rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
              />
              <input
                type="text"
                placeholder="Topic"
                value={createGroupForm.topic}
                onChange={(e) => setCreateGroupForm(prev => ({ ...prev, topic: e.target.value }))}
                className="w-full bg-black text-white border border-white rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
              />
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={createGroupForm.is_private}
                  onChange={(e) => setCreateGroupForm(prev => ({ ...prev, is_private: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-white">Private Group</span>
              </label>
            </div>
            <div className="flex space-x-2 mt-6">
              <button
                onClick={createGroup}
                disabled={!createGroupForm.name.trim()}
                className="flex-1 bg-white text-black py-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New DM Modal */}
      {showNewDMModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black border border-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4 text-white">Start New Conversation</h2>
            <select
              value={selectedUserForDM}
              onChange={(e) => setSelectedUserForDM(e.target.value)}
              className="w-full bg-black text-white border border-white rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
            >
              <option value="">Select a user...</option>
              {users.map(user => (
                <option key={user.user_id} value={user.user_id}>
                  {user.username}
                </option>
              ))}
            </select>
            <div className="flex space-x-2 mt-6">
              <button
                onClick={startNewDM}
                disabled={!selectedUserForDM}
                className="flex-1 bg-white text-black py-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Start Conversation
              </button>
              <button
                onClick={() => setShowNewDMModal(false)}
                className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateChannelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black border border-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4 text-white">Create New Channel</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Channel Name"
                value={createChannelForm.name}
                onChange={(e) => setCreateChannelForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-black text-white border border-white rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={createChannelForm.description}
                onChange={(e) => setCreateChannelForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full bg-black text-white border border-white rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
              />
            </div>
            <div className="flex space-x-2 mt-6">
              <button
                onClick={createChannel}
                disabled={!createChannelForm.name.trim()}
                className="flex-1 bg-white text-black py-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateChannelModal(false)}
                className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black border border-white rounded-lg p-6 w-96 max-h-96 overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold mb-4 text-white">Group Members</h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {groupMembers.map(member => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-2 bg-gray-800 rounded"
                  onContextMenu={(e) => handleMemberContextMenu(e, member)}
                >
                  <div className="flex items-center space-x-2">
                    <ProfileAvatar userId={member.user_id} size={24} />
                    <span className="text-white">{member.username}</span>
                    <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                      {member.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowMembersModal(false)}
              className="mt-4 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Invite Modal */}
           {showInviteModal && (
               <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black border border-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4 text-white">Invite User to Group</h2>
            <select
              value={selectedUserToInvite}
              onChange={(e) => setSelectedUserToInvite(e.target.value)}
              className="w-full bg-black text-white border border-white rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white"
            >
              <option value="">Select a user...</option>
                           {availableUsers.map(user => (
                <option key={user.user_id} value={user.user_id}>
                  {user.username}
                </option>
              ))}
            </select>
            <div className="flex space-x-2 mt-6">
              <button
                onClick={inviteUserToGroup}
                disabled={!selectedUserToInvite || inviteLoading}
                className="flex-1 bg-white text-black py-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {inviteLoading ? 'Sending...' : 'Send Invitation'}
              </button>
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invitations Modal */}
      {showInvitationsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-black border border-white rounded-lg p-6 w-96 max-h-96 overflow-hidden flex flex-col">
            <h2 className="text-xl font-bold mb-4 text-white">Group Invitations</h2>
            <div className="flex-1 overflow-y-auto space-y-3">
              {invitations.length === 0 ? (
                <p className="text-gray-400">No pending invitations</p>
              ) : (
                invitations.map(invitation => (
                  <div key={invitation.invitation_id} className="p-3 bg-gray-800 rounded">
                    <div className="mb-2">
                      <span className="font-semibold text-white">{invitation.group_name}</span>
                      <p className="text-sm text-gray-400">
                        Invited by {invitation.inviter_username}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => respondToInvitation(invitation.invitation_id, 'accept')}
                        className="flex-1 bg-green-600 text-white py-1 rounded hover:bg-green-700 transition-colors text-sm"
                      >
                        Accept
                     
                      </button>
                      <button
                        onClick={() => respondToInvitation(invitation.invitation_id, 'decline')}
                        className="flex-1 bg-red-600 text-white py-1 rounded hover:bg-red-700 transition-colors text-sm"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setShowInvitationsModal(false)}
              className="mt-4 bg-gray-600 text-white py-2 rounded hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedMessages;
