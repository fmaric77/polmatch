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
import { profilePictureCache } from '../lib/profilePictureCache';

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
  // Profile switcher props
  activeProfileType,
  setActiveProfileType
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
      <div className={`${isMobile ? 'fixed left-20 top-0 z-40 h-full' : ''} w-80 bg-black border-2 border-white rounded-none shadow-2xl flex flex-col h-full transition-transform duration-300 ${
        isMobile ? (isConversationsSidebarHidden ? '-translate-x-full' : 'translate-x-0') : 'translate-x-0'
      }`}>
        {/* Header */}
        <div className="border-b-2 border-white bg-white text-black p-3 text-center">
          <h1 className="text-lg font-bold tracking-widest uppercase">
            {selectedCategory === 'direct' ? 'Messages' : 'Groups'}
          </h1>
        </div>

        {/* Control Panel */}
        <div className="p-4 border-b-2 border-white bg-black/40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FontAwesomeIcon 
                icon={selectedCategory === 'direct' ? faUser : faUsers} 
                className="text-white mr-2"
              />
              <span className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                {selectedCategory === 'direct' ? 'CONTACTS' : 'GROUPS'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {/* Conversations Sidebar Toggle Button */}
              <button
                onClick={() => setIsConversationsSidebarHidden(!isConversationsSidebarHidden)}
                className="p-2 bg-red-900 text-white border border-red-700 hover:bg-red-800 transition-colors font-mono text-xs uppercase tracking-wider"
                title={isConversationsSidebarHidden ? "SHOW PANEL" : "HIDE PANEL"}
              >
                <FontAwesomeIcon icon={faBars} className="text-sm" />
              </button>
              {/* Mobile Close Button */}
              {isMobile && (
                <button
                  onClick={() => setIsConversationsSidebarHidden(true)}
                  className="p-2 bg-red-900 text-white border border-red-700 hover:bg-red-800 transition-colors font-mono text-xs uppercase tracking-wider"
                  title="CLOSE PANEL"
                >
                  <FontAwesomeIcon icon={faTimes} className="text-sm" />
                </button>
              )}
            </div>
          </div>

          {/* Profile Type Switcher - only show for direct messages */}
          {selectedCategory === 'direct' && (
            <div className="mb-4">
              <div className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-wider">Profile Type:</div>
              <div className="flex gap-1 p-1 bg-gray-800 border border-white rounded-none">
                {(['basic', 'love', 'business'] as const).map((profileType) => (
                  <button
                    key={profileType}
                    onClick={() => setActiveProfileType(profileType)}
                    className={`flex-1 px-2 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                      activeProfileType === profileType
                        ? 'bg-white text-black font-bold'
                        : 'bg-transparent text-white hover:bg-white/20'
                    }`}
                  >
                    {profileType === 'basic' ? 'GENERAL' : profileType === 'love' ? 'PERSONAL' : 'CORPORATE'}
                  </button>
                ))}
              </div>
            </div>
          )}

          
          {/* Connection Status Indicator */}
          {sessionToken && (
            <div className="mb-4">
              <div className="flex items-center justify-between p-2 rounded border border-gray-600 bg-gray-800/50">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-xs font-mono text-gray-300 uppercase tracking-wider">
                    {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>
                {!isConnected && onReconnect && (
                  <button
                    onClick={onReconnect}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-mono uppercase tracking-wider border border-blue-500 transition-colors"
                    title="Reconnect to receive notifications"
                  >
                    RECONNECT
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
              placeholder={`Search ${selectedCategory === 'direct' ? 'contacts' : 'groups'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black text-white border border-white rounded-none px-3 py-2 pl-8 text-sm focus:outline-none focus:border-white/60 font-mono placeholder-gray-500"
            />
            <FontAwesomeIcon 
              icon={faSearch} 
              className="absolute left-2 top-2 text-white opacity-60 text-sm"
            />
          </div>
        </div>

        {/* Communications List */}
        <div className="flex-1 overflow-y-auto bg-black">
          {(() => {
            if (filteredConversations.length === 0 && allConversationsForCategory.length > 0) {
              return (
                <div className="p-6 text-center border border-gray-600 bg-gray-900/50 m-4">
                  <div className="font-mono text-gray-400 mb-2 uppercase tracking-wider">
                    NO {selectedCategory === 'direct' ? 'CONTACTS' : 'OPERATIONS'} MATCH SEARCH
                  </div>
                  <div className="text-xs font-mono text-gray-500 uppercase">
                    QUERY: &quot;{searchQuery}&quot;
                  </div>
                  <div className="text-xs font-mono text-gray-500 mt-2 uppercase">
                    {selectedCategory === 'direct' 
                      ? 'Start a new conversation' 
                      : 'Create a new group'
                    }
                  </div>
                </div>
              );
            }
            
            if (allConversationsForCategory.length === 0) {
              return (
                <div className="p-6 text-center border border-gray-600 bg-gray-900/50 m-4">
                  <div className="font-mono text-gray-400 mb-2 uppercase tracking-wider">
                    NO {selectedCategory === 'direct' ? 'CONVERSATIONS' : 'GROUPS'}
                  </div>
                  <div className="text-xs font-mono text-gray-500 uppercase">
                    {selectedCategory === 'direct' 
                      ? 'Find users to message' 
                      : 'Create or join groups'
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
                className={`mx-4 my-2 border border-gray-600 bg-gray-900/50 hover:bg-gray-800/60 transition-colors cursor-pointer ${
                  selectedConversation === conversation.id ? 'bg-white/10 border-white' : ''
                }`}
              >
                {/* File Content */}
                <div className="p-3">
                  <div className="flex items-start space-x-3">
                    {/* Photo/Icon Section */}
                    <div className="border-2 border-white bg-gray-800 p-2 flex-shrink-0">
                      {conversation.type === 'direct' && conversation.user_id ? (
                        <ProfileAvatar userId={conversation.user_id} size={32} />
                      ) : (
                        <div className="w-8 h-8 bg-gray-600 rounded-none flex items-center justify-center">
                          <FontAwesomeIcon 
                            icon={conversation.type === 'group' ? faHashtag : faAt} 
                            className="text-white text-sm"
                          />
                        </div>
                      )}
                    </div>
                    
                    {/* File Details */}
                    <div className="flex-1 min-w-0 font-mono">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-white uppercase tracking-wider truncate">
                            {conversation.name}
                          </span>
                          {conversation.type === 'group' && conversation.is_private && (
                            <FontAwesomeIcon icon={faLock} className="text-red-400 text-xs" />
                          )}
                        </div>
                        {conversation.unread_count && conversation.unread_count > 0 && (
                          <span className="bg-red-500 text-white text-xs font-mono font-bold rounded-none px-2 py-1 min-w-[24px] text-center border border-white">
                            {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                          </span>
                        )}
                      </div>
                      
                      <div className="text-xs text-gray-400 mb-1">
                        {conversation.type === 'direct' ? 'Direct Message' : 'Group'}
                      </div>
                      
                      {conversation.last_message && (
                        <div className="text-xs text-gray-300 border-t border-gray-600 pt-2 mt-2">
                          <span className="text-gray-400">Last message:</span>
                          <div className="truncate">{conversation.last_message}</div>
                        </div>
                      )}
                      
                      {conversation.type === 'group' && conversation.members_count && (
                        <div className="text-xs text-gray-400 mt-1">
                          Members: {conversation.members_count}
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