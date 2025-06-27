import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSearch, 
  faHashtag,
  faUser,
  faUsers,
  faBars,
  faTimes,
  faAt,
  faLock
} from '@fortawesome/free-solid-svg-icons';
import ProfileAvatar from './ProfileAvatar';
import StatusIndicator from './StatusIndicator';
import StatusSelector from './StatusSelector';
import { profilePictureCache } from '../lib/profilePictureCache';
import { UserStatus } from './hooks/useUserStatus';

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
  selectedCategory: 'direct' | 'groups';
  selectedConversation: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSelectConversation: (conversation: Conversation) => void;
  onConversationContextMenu: (e: React.MouseEvent, conversation: Conversation) => void;
  isMobile: boolean;
  isConversationsSidebarHidden: boolean;
  setIsConversationsSidebarHidden: (hidden: boolean) => void;
  setIsSidebarVisible: (visible: boolean) => void;
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
  onStatusChange?: (status: UserStatus, customMessage?: string) => Promise<boolean>;
}

const ConversationsList: React.FC<ConversationsListProps> = ({
  conversations,
  selectedCategory,
  selectedConversation,
  searchQuery,
  setSearchQuery,
  onSelectConversation,
  onConversationContextMenu,
  isMobile,
  isConversationsSidebarHidden,
  setIsConversationsSidebarHidden,
  setIsSidebarVisible,
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
  onStatusChange
}) => {
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
    if (selectedCategory === 'direct') {
      return c.type === 'direct';
    } else if (selectedCategory === 'groups') {
      return c.type === 'group';
    }
    return false;
  });

  if (!isConversationsSidebarHidden) {
    return (
      <div className={`${isMobile ? 'fixed left-20 top-0 z-40 h-full' : ''} w-80 bg-black/40 border border-white/30 rounded-lg flex flex-col h-full transition-transform duration-300 ${
        isMobile ? (isConversationsSidebarHidden ? '-translate-x-full' : 'translate-x-0') : 'translate-x-0'
      }`}>
        {/* Header */}
        <div className="border-b border-white/30 bg-white/5 text-white p-3 text-center">
          <h1 className="text-lg font-bold tracking-wider uppercase">
            {selectedCategory === 'direct' ? 'Messages' : 'Groups'}
          </h1>
        </div>

        {/* Control Panel */}
        <div className="p-4 border-b border-white/30 bg-black/40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon 
                icon={selectedCategory === 'direct' ? faUser : faUsers} 
                className="text-white mr-2"
              />
              <span className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                {selectedCategory === 'direct' ? 'Messages' : 'Groups'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {/* Conversations Sidebar Toggle Button */}
              <button
                onClick={() => setIsConversationsSidebarHidden(!isConversationsSidebarHidden)}
                className="p-2 bg-white/10 text-white border border-white/30 hover:bg-white/20 transition-colors rounded"
                title={isConversationsSidebarHidden ? "Show" : "Hide"}
              >
                <FontAwesomeIcon icon={faBars} className="text-sm" />
              </button>
              {/* Mobile Close Button */}
              {isMobile && (
                <button
                  onClick={() => setIsConversationsSidebarHidden(true)}
                  className="p-2 bg-white/10 text-white border border-white/30 hover:bg-white/20 transition-colors rounded"
                  title="Close"
                >
                  <FontAwesomeIcon icon={faTimes} className="text-sm" />
                </button>
              )}
            </div>
          </div>

          {/* Profile Type Switcher */}
          <div className="mb-4">
            <div className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-wider">Profile:</div>
            <div className="flex gap-1 p-1 bg-black/60 border border-white/30 rounded">
              {(['basic', 'love', 'business'] as const).map((profileType) => {
                const invitationCount = invitationSummary?.[profileType] || 0;
                return (
                  <button
                    key={profileType}
                    onClick={() => setActiveProfileType(profileType)}
                    className={`relative flex-1 px-2 py-2 font-mono text-xs uppercase tracking-wider transition-colors rounded ${
                      activeProfileType === profileType
                        ? 'bg-white text-black font-bold'
                        : 'bg-transparent text-white hover:bg-white/20'
                    }`}
                  >
                    {profileType === 'basic' ? 'General' : profileType === 'love' ? 'Dating' : 'Business'}
                    {invitationCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {invitationCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Status Selector */}
          {getUserStatus && currentUser && (
            <div className="mb-4">
              <div className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-wider">Status:</div>
              <StatusSelector
                currentStatus={getUserStatus(currentUser.user_id)?.status || 'offline'}
                customMessage={getUserStatus(currentUser.user_id)?.custom_message}
                                 onStatusChange={onStatusChange || (async () => false)}
                className="w-full"
              />
            </div>
          )}

          {/* Connection Status Indicator */}
          {sessionToken && (
            <div className="mb-4">
              <div className="flex items-center justify-between p-2 rounded border border-white/30 bg-black/60">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                {!isConnected && onReconnect && (
                  <button
                    onClick={onReconnect}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-mono uppercase tracking-wider rounded transition-colors"
                    title="Reconnect to receive notifications"
                  >
                    Reconnect
                  </button>
                )}
              </div>
              {connectionError && (
                <div className="mt-1 text-xs text-red-400 font-mono">
                  {connectionError}
                </div>
              )}
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder={`Search ${selectedCategory === 'direct' ? 'messages' : 'groups'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black text-white border border-white/30 rounded px-3 py-2 pl-8 text-sm focus:outline-none focus:border-white/60 font-mono placeholder-gray-500"
            />
            <FontAwesomeIcon 
              icon={faSearch} 
              className="absolute left-2 top-2 text-white opacity-60 text-sm"
            />
          </div>
        </div>

        {/* Communications List */}
        <div className="flex-1 overflow-y-auto bg-black/20">
          {(() => {
            if (filteredConversations.length === 0 && allConversationsForCategory.length > 0) {
              return (
                <div className="p-6 text-center border border-white/30 bg-black/40 m-4 rounded">
                  <div className="font-mono text-gray-400 mb-2 uppercase tracking-wider">
                    No {selectedCategory === 'direct' ? 'messages' : 'groups'} found
                  </div>
                  <div className="text-xs font-mono text-gray-500">
                    Search: &quot;{searchQuery}&quot;
                  </div>
                </div>
              );
            }
            
            if (allConversationsForCategory.length === 0) {
              return (
                <div className="p-6 text-center border border-white/30 bg-black/40 m-4 rounded">
                  <div className="font-mono text-gray-400 mb-2 uppercase tracking-wider">
                    No {selectedCategory === 'direct' ? 'messages' : 'groups'} yet
                  </div>
                  <div className="text-xs font-mono text-gray-500">
                    {selectedCategory === 'direct' 
                      ? 'Start a conversation' 
                      : 'Create or join a group'
                    }
                  </div>
                </div>
              );
            }
            
            return filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => {
                  onSelectConversation(conversation);
                  if (isMobile) setIsSidebarVisible(false);
                }}
                onContextMenu={e => onConversationContextMenu(e, conversation)}
                className={`mx-4 my-2 border border-white/30 bg-black/40 hover:bg-black/60 transition-colors cursor-pointer rounded ${
                  selectedConversation === conversation.id ? 'bg-white/10 border-white' : ''
                }`}
              >
                <div className="p-3">
                  <div className="flex items-start space-x-3">
                    {/* Avatar/Icon Section */}
                    <div className="border border-white/30 bg-black/60 p-2 flex-shrink-0 rounded relative">
                      {conversation.type === 'direct' && conversation.user_id ? (
                        <>
                          <ProfileAvatar userId={conversation.user_id} size={32} />
                          {/* Status Indicator for Direct Messages */}
                          {getUserStatus && (() => {
                            const userStatus = getUserStatus(conversation.user_id);
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
                        </>
                      ) : (
                        <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">
                          <FontAwesomeIcon 
                            icon={conversation.type === 'group' ? faHashtag : faAt} 
                            className="text-white text-sm"
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* Content Details - Fixed overflow */}
                    <div className="flex-1 min-w-0 font-mono">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <span className="text-sm font-bold text-white uppercase tracking-wider truncate block max-w-full">
                            {conversation.name}
                          </span>
                          {conversation.type === 'group' && conversation.is_private && (
                            <FontAwesomeIcon icon={faLock} className="text-red-400 text-xs flex-shrink-0" />
                          )}
                        </div>
                        {conversation.unread_count && conversation.unread_count > 0 && (
                          <span className="bg-red-500 text-white text-xs font-mono font-bold rounded px-2 py-1 min-w-[24px] text-center border border-white flex-shrink-0 ml-2">
                            {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-400 mb-1">
                        {conversation.type === 'direct' ? 'Direct' : 'Group'}
                        {conversation.type === 'group' && conversation.members_count && (
                          <span className="ml-2">• {conversation.members_count} members</span>
                        )}
                      </div>
                      
                      {conversation.last_message && (
                        <div className="text-xs text-gray-300 border-t border-white/20 pt-2 mt-2">
                          <div className="truncate">{conversation.last_message}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    );
  }

  return null;
};

export default ConversationsList;