import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSearch, 
  faUsers,
  faTimes,
  faLock,
  faEnvelope,
  faComments,
  faPlus
} from '@fortawesome/free-solid-svg-icons';
import ProfileAvatar from './ProfileAvatar';
import StatusIndicator from './StatusIndicator';
import { profilePictureCache } from '../lib/profilePictureCache';
import { UserStatus } from './hooks/useUserStatus';
import { useTheme } from './ThemeProvider';

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

interface ConversationsListProps {
  conversations: Conversation[];
  selectedCategory: 'direct' | 'groups' | 'unified'; // Add unified option
  selectedConversation: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSelectConversation: (conversation: Conversation) => void;
  onConversationContextMenu: (e: React.MouseEvent, conversation: Conversation) => void;
  isConversationsSidebarHidden: boolean;
  setIsConversationsSidebarHidden: (hidden: boolean) => void;
  // SSE status props
  isConnected: boolean;
  connectionError: string | null;
  sessionToken: string | null;
  onReconnect?: () => void;
  currentUser: { user_id: string; username: string } | null;
  // Profile switcher props
  activeProfileType: 'basic' | 'love' | 'business';
  setActiveProfileType: (type: 'basic' | 'love' | 'business') => void;
  // Invitation summary prop
  invitationSummary?: Record<string, number>;
  // Status props
  getUserStatus?: (userId: string) => { status: UserStatus; custom_message?: string } | null;
  onStatusChange?: (userId: string, status: UserStatus, customMessage?: string) => Promise<boolean>;
  // Action props
  onCreateGroup?: () => void;
  onNewMessage?: () => void;
}

const ConversationsList: React.FC<ConversationsListProps> = ({
  conversations,
  selectedCategory,
  selectedConversation,
  searchQuery,
  setSearchQuery,
  onSelectConversation,
  onConversationContextMenu,
  isConversationsSidebarHidden,
  setIsConversationsSidebarHidden,
  // SSE status props
  isConnected,
  connectionError,
  sessionToken,
  onReconnect,
  currentUser,
  // Profile switcher props
  activeProfileType,
  setActiveProfileType,
  // Invitation summary prop
  invitationSummary,
  // Status props
  getUserStatus,
  onStatusChange,
  // Action props
  onCreateGroup,
  onNewMessage
}) => {
  const { theme } = useTheme();
  
  // Prefetch profile pictures for all direct conversations to reduce spam
  useEffect(() => {
    const directConversations = conversations.filter(c => c.type === 'direct' && c.user_id);
    const userIds = directConversations.map(c => c.user_id!).filter(Boolean);
    
    if (userIds.length > 0) {
      // Batch prefetch all profile pictures efficiently
      profilePictureCache.prefetchMultiple(userIds)
        .catch(err => console.warn('Error prefetching profile pictures:', err));
    }
  }, [conversations]);

  const filteredConversations = conversations
    .filter(conversation => {
      // Unified view shows all conversations
      if (selectedCategory === 'unified') {
        return true;
      }
      // Legacy category filtering for specific use cases
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

  const allConversationsForCategory = conversations.filter(c => {
    if (selectedCategory === 'unified') {
      return true; // Show all for unified view
    }
    if (selectedCategory === 'direct') {
      return c.type === 'direct';
    } else if (selectedCategory === 'groups') {
      return c.type === 'group';
    }
    return false;
  });

  // Group conversations by type for better organization in unified view
  const directConversations = filteredConversations.filter(c => c.type === 'direct');
  const groupConversations = filteredConversations.filter(c => c.type === 'group');

  // Compute pending invitations (>0 only)
  const pendingInviteEntries = invitationSummary 
    ? Object.entries(invitationSummary).filter(([, count]) => count > 0) 
    : [] as Array<[string, number]>;
  const hasPendingInvites = pendingInviteEntries.length > 0;

  if (!isConversationsSidebarHidden) {
    return (
      <div className={`w-80 ${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border-r h-full flex flex-col overflow-hidden`}>
        
        {/* Connection Status */}
        <div className={`p-3 border-b ${theme === 'dark' ? 'border-white bg-black' : 'border-black bg-white'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className={`text-xs font-medium ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
              {connectionError && onReconnect && (
                <button 
                  onClick={onReconnect}
                  className={`text-xs ${theme === 'dark' ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'} underline`}
                >
                  Reconnect
                </button>
              )}
            </div>
            
            {/* Retract Button - Always visible */}
            <button
              onClick={() => setIsConversationsSidebarHidden(true)}
              className={`p-1 ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-800' : 'text-gray-600 hover:text-black hover:bg-gray-200'} rounded transition-colors`}
              title="Hide Conversations Sidebar"
            >
              <FontAwesomeIcon icon={faTimes} size="sm" />
            </button>
          </div>
          
          {sessionToken && (
            <div className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} truncate`}>
              Session: {sessionToken.substring(0, 8)}...
            </div>
          )}
        </div>

        {/* Profile Type Switcher - Only show in unified or direct view */}
        {(selectedCategory === 'unified' || selectedCategory === 'direct') && (
          <div className={`p-3 border-b ${theme === 'dark' ? 'border-white' : 'border-black'}`}>
            <div className="flex gap-1">
              {(['basic', 'love', 'business'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveProfileType(type)}
                  className={`flex-1 px-3 py-1 text-xs font-medium transition-colors ${
                    activeProfileType === type
                      ? theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'
                      : theme === 'dark' ? 'bg-black text-white border border-white hover:bg-gray-800' : 'bg-white text-black border border-black hover:bg-gray-200'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className={`p-3 border-b ${theme === 'dark' ? 'border-white' : 'border-black'}`}>
          <input
            type="text"
                            placeholder={selectedCategory === 'unified' ? "Search all conversations..." : `Search ${selectedCategory}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full p-2 border ${theme === 'dark' ? 'bg-black text-white border-white placeholder-gray-400' : 'bg-white text-black border-black placeholder-gray-600'} focus:outline-none`}
          />
        </div>

        {/* Invitations Summary - Show for groups or unified, only when there are pending invites */}
        {(selectedCategory === 'groups' || selectedCategory === 'unified') && hasPendingInvites && (
          <div className={`p-3 border-b ${theme === 'dark' ? 'border-white bg-gray-900' : 'border-black bg-gray-100'}`}>
            <div className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              Pending Invitations
            </div>
            {pendingInviteEntries.map(([groupId, count]) => (
              <div key={groupId} className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} mb-1`}>
                {count} invitation{count > 1 ? 's' : ''} to group
              </div>
            ))}
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {selectedCategory === 'unified' ? (
            // Unified view with sections
            <>
              {/* Direct Messages Section */}
              {(directConversations.length > 0 || onNewMessage) && (
                <div>
                  <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400 bg-gray-900' : 'text-gray-600 bg-gray-100'} sticky top-0 flex items-center justify-between`}>
                    <div className="flex items-center">
                      <FontAwesomeIcon icon={faEnvelope} className="mr-2" />
                      Direct Messages ({directConversations.length})
                    </div>
                    {onNewMessage && (
                      <button
                        onClick={onNewMessage}
                        className="ml-2 w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-colors text-xs"
                        title="New Message"
                      >
                        <FontAwesomeIcon icon={faPlus} />
                      </button>
                    )}
                  </div>
                  {directConversations.length > 0 ? (
                    directConversations.map((conversation, index) => (
                      <ConversationItem
                        key={`unified-direct-${conversation.id}-${index}`}
                        conversation={conversation}
                        isSelected={selectedConversation === conversation.id}
                        onSelect={onSelectConversation}
                        onContextMenu={onConversationContextMenu}
                        theme={theme}
                        getUserStatus={getUserStatus}
                        onStatusChange={onStatusChange}
                        currentUser={currentUser}
                      />
                    ))
                  ) : onNewMessage && (
                    <div className={`p-4 text-center ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                      <p className="text-sm">No conversations yet</p>
                      <p className="text-xs mt-1">Start your first conversation!</p>
                    </div>
                  )}
                </div>
              )}

              {/* Groups Section */}
              {(groupConversations.length > 0 || onCreateGroup) && (
                <div>
                  <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400 bg-gray-900' : 'text-gray-600 bg-gray-100'} sticky top-0 flex items-center justify-between`}>
                    <div className="flex items-center">
                      <FontAwesomeIcon icon={faUsers} className="mr-2" />
                      Groups ({groupConversations.length})
                    </div>
                    {onCreateGroup && (
                      <button
                        onClick={onCreateGroup}
                        className="ml-2 w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-colors text-xs"
                        title="Create Group"
                      >
                        <FontAwesomeIcon icon={faPlus} />
                      </button>
                    )}
                  </div>
                  {groupConversations.length > 0 ? (
                    groupConversations.map((conversation, index) => (
                      <ConversationItem
                        key={`unified-group-${conversation.id}-${index}`}
                        conversation={conversation}
                        isSelected={selectedConversation === conversation.id}
                        onSelect={onSelectConversation}
                        onContextMenu={onConversationContextMenu}
                        theme={theme}
                        getUserStatus={getUserStatus}
                        onStatusChange={onStatusChange}
                        currentUser={currentUser}
                      />
                    ))
                  ) : onCreateGroup && (
                    <div className={`p-4 text-center ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                      <p className="text-sm">No groups yet</p>
                      <p className="text-xs mt-1">Create your first group!</p>
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {filteredConversations.length === 0 && (
                <div className={`p-6 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {searchQuery ? (
                    <>
                      <FontAwesomeIcon icon={faSearch} size="2x" className="mb-3 opacity-50" />
                      <p>No conversations found for &quot;{searchQuery}&quot;</p>
                    </>
                  ) : allConversationsForCategory.length === 0 ? (
                    <>
                      <FontAwesomeIcon icon={faComments} size="2x" className="mb-3 opacity-50" />
                      <p>No conversations yet</p>
                      <p className="text-sm mt-2">Start a new conversation or join a group!</p>
                    </>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            // Legacy category view (for specific use cases)
            <>
              {filteredConversations.map((conversation, index) => (
                <ConversationItem
                  key={`legacy-${conversation.type}-${conversation.id}-${index}`}
                  conversation={conversation}
                  isSelected={selectedConversation === conversation.id}
                  onSelect={onSelectConversation}
                  onContextMenu={onConversationContextMenu}
                  theme={theme}
                  getUserStatus={getUserStatus}
                  onStatusChange={onStatusChange}
                  currentUser={currentUser}
                />
              ))}

              {/* Empty State */}
              {filteredConversations.length === 0 && (
                <div className={`p-6 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {searchQuery ? (
                    <>
                      <FontAwesomeIcon icon={faSearch} size="2x" className="mb-3 opacity-50" />
                      <p>No {selectedCategory} found for &quot;{searchQuery}&quot;</p>
                    </>
                  ) : allConversationsForCategory.length === 0 ? (
                    <>
                      <FontAwesomeIcon icon={selectedCategory === 'direct' ? faEnvelope : faUsers} size="2x" className="mb-3 opacity-50" />
                      <p>No {selectedCategory} yet</p>
                      <p className="text-sm mt-2">
                        {selectedCategory === 'direct' ? 'Start a new conversation!' : 'Join or create a group!'}
                      </p>
                    </>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Mobile collapsed view
  return (
    <div className={`${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border-r-4 h-full flex flex-col items-center py-4`}>
      <button
        onClick={() => setIsConversationsSidebarHidden(false)}
        className={`p-3 ${theme === 'dark' ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-200'} rounded transition-colors`}
        title="Show Conversations"
      >
        <FontAwesomeIcon icon={faEnvelope} size="lg" />
      </button>
    </div>
  );
};

// ConversationItem component for cleaner code
interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: (conversation: Conversation) => void;
  onContextMenu: (e: React.MouseEvent, conversation: Conversation) => void;
  theme: string;
  getUserStatus?: (userId: string) => { status: UserStatus; custom_message?: string } | null;
  onStatusChange?: (userId: string, status: UserStatus, customMessage?: string) => Promise<boolean>;
  currentUser: { user_id: string; username: string } | null;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isSelected,
  onSelect,
  onContextMenu,
  theme,
  getUserStatus
}) => {
  return (
    <div
      onClick={() => onSelect(conversation)}
      onContextMenu={(e) => onContextMenu(e, conversation)}
      className={`p-3 border-b ${theme === 'dark' ? 'border-gray-800 hover:bg-gray-900' : 'border-gray-200 hover:bg-gray-50'} cursor-pointer transition-colors ${
        isSelected ? (theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100') : ''
      }`}
    >
      <div className="flex items-center space-x-3">
        {/* Avatar/Icon */}
        <div className="flex-shrink-0 relative">
          {conversation.type === 'direct' && conversation.user_id ? (
            <>
              <ProfileAvatar userId={conversation.user_id} size={40} />
              {getUserStatus && (() => {
                const userStatus = getUserStatus(conversation.user_id);
                return userStatus ? (
                  <div className="absolute -bottom-1 -right-1">
                    <StatusIndicator 
                      status={userStatus.status} 
                      size="small" 
                      inline 
                      className={`border-2 ${theme === 'dark' ? 'border-black' : 'border-white'}`}
                    />
                  </div>
                ) : null;
              })()}
            </>
          ) : (
            <div className={`w-10 h-10 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'} rounded-full flex items-center justify-center`}>
              <FontAwesomeIcon 
                icon={conversation.type === 'group' ? faUsers : faEnvelope} 
                className={`${theme === 'dark' ? 'text-white' : 'text-gray-600'} text-sm`}
              />
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-black'} truncate`}>
                {conversation.name}
              </span>
              {conversation.type === 'group' && conversation.is_private && (
                <FontAwesomeIcon icon={faLock} className="text-red-400 text-xs flex-shrink-0" />
              )}
            </div>
            {conversation.unread_count && conversation.unread_count > 0 && (
              <span className="bg-blue-500 text-white text-xs font-bold rounded-full px-2 py-1 min-w-[20px] text-center">
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </span>
            )}
          </div>
          
          <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
            {conversation.type === 'direct' ? 'Direct Message' : 'Group'}
            {conversation.type === 'group' && conversation.members_count && (
              <span className="ml-2">• {conversation.members_count} members</span>
            )}
          </div>
          
          {conversation.last_message && (
            <div className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'} truncate`}>
              {conversation.last_message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationsList;