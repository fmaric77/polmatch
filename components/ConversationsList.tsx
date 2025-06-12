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
  currentUser,
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
        {/* FBI-Style Header */}
        <div className="border-b-2 border-white bg-white text-black p-3 text-center">
          <div className="font-mono text-xs mb-1 font-bold tracking-widest">SECURE COMMUNICATIONS</div>
          <h1 className="text-lg font-bold tracking-widest uppercase">
            {selectedCategory === 'direct' ? 'DIRECT CHANNELS' : 'GROUP OPERATIONS'}
          </h1>
          <div className="font-mono text-xs mt-1 tracking-widest">CLASSIFICATION: {selectedCategory === 'direct' ? 'PERSONAL' : 'OPERATIONAL'}</div>
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
                ACTIVE {selectedCategory === 'direct' ? 'CONTACTS' : 'OPERATIONS'}
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
              <div className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-wider">SECURITY CLEARANCE:</div>
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

          {/* SSE Connection Status */}
          <div className="mb-4 p-3 bg-black/60 border border-white/20 rounded-none">
            <div className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-wider">CONNECTION STATUS:</div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className={`p-2 border ${isConnected ? 'border-green-400 bg-green-900/20 text-green-400' : 'border-red-400 bg-red-900/20 text-red-400'}`}>
                <div className="font-bold">LINK: {isConnected ? 'SECURE' : 'BROKEN'}</div>
              </div>
              <div className={`p-2 border ${sessionToken ? 'border-green-400 bg-green-900/20 text-green-400' : 'border-red-400 bg-red-900/20 text-red-400'}`}>
                <div className="font-bold">AUTH: {sessionToken ? 'VALID' : 'INVALID'}</div>
              </div>
            </div>
            {connectionError && (
              <div className="text-red-400 mt-2 text-xs font-mono border border-red-400 bg-red-900/20 p-2">
                ERROR: {connectionError.toUpperCase()}
              </div>
            )}
            {currentUser && (
              <div className="text-gray-400 mt-2 text-xs font-mono">
                AGENT ID: {currentUser.user_id.substring(0, 8).toUpperCase()}
              </div>
            )}
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <div className="text-xs font-mono text-gray-400 mb-2 uppercase tracking-wider">TARGET SEARCH:</div>
            <input
              type="text"
              placeholder={`[SEARCH ${selectedCategory === 'direct' ? 'CONTACTS' : 'OPERATIONS'}]`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black text-white border border-white rounded-none px-3 py-2 pl-8 text-sm focus:outline-none focus:border-white/60 font-mono placeholder-gray-500"
            />
            <FontAwesomeIcon 
              icon={faSearch} 
              className="absolute left-2 top-8 text-white opacity-60 text-sm"
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
                    QUERY: "{searchQuery}"
                  </div>
                  <div className="text-xs font-mono text-gray-500 mt-2 uppercase">
                    {selectedCategory === 'direct' 
                      ? 'INITIATE NEW SECURE CHANNEL' 
                      : 'ESTABLISH NEW OPERATION'
                    }
                  </div>
                </div>
              );
            }
            
            if (allConversationsForCategory.length === 0) {
              return (
                <div className="p-6 text-center border border-gray-600 bg-gray-900/50 m-4">
                  <div className="font-mono text-gray-400 mb-2 uppercase tracking-wider">
                    NO {selectedCategory === 'direct' ? 'SECURE CHANNELS' : 'ACTIVE OPERATIONS'}
                  </div>
                  <div className="text-xs font-mono text-gray-500 uppercase">
                    {selectedCategory === 'direct' 
                      ? 'ESTABLISH CONTACT WITH AGENTS' 
                      : 'CREATE OR JOIN OPERATIONS'
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
                {/* File Header */}
                <div className="bg-white text-black p-2 font-mono text-xs flex justify-between border-b border-gray-600">
                  <span className="font-bold">{conversation.type === 'direct' ? 'CONTACT FILE' : 'OPERATION FILE'}</span>
                  <span>ID: {conversation.id.substring(0, 8).toUpperCase()}</span>
                </div>
                
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
                        STATUS: {conversation.type === 'direct' ? 'ACTIVE CONTACT' : 'OPERATIONAL'}
                      </div>
                      
                      {conversation.last_message && (
                        <div className="text-xs text-gray-300 border-t border-gray-600 pt-2 mt-2">
                          <span className="text-gray-400">LAST TRANSMISSION:</span>
                          <div className="truncate">{conversation.last_message}</div>
                        </div>
                      )}
                      
                      {conversation.type === 'group' && conversation.members_count && (
                        <div className="text-xs text-gray-400 mt-1">
                          PERSONNEL: {conversation.members_count}
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