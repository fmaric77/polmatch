import React from 'react';
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
  setIsSidebarVisible
}) => {
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
      <div className={`${isMobile ? 'fixed left-16 top-0 z-40 h-full' : ''} w-60 bg-black flex flex-col border-r border-white h-full transition-transform duration-300 ${
        isMobile ? (isConversationsSidebarHidden ? '-translate-x-full' : 'translate-x-0') : 'translate-x-0'
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
            if (filteredConversations.length === 0 && allConversationsForCategory.length > 0) {
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
            
            if (allConversationsForCategory.length === 0) {
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
                  onSelectConversation(conversation);
                  if (isMobile) setIsSidebarVisible(false);
                }}
                onContextMenu={e => onConversationContextMenu(e, conversation)}
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
    );
  }

  return null;
};

export default ConversationsList;