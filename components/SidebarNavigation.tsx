import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUsers,
  faUser,
  faSearch,
  faUserPlus,
  faBell,
  faHome,
  faEnvelope,
  faSignOutAlt,
  faKey,
  faTimes,
  faBookmark
} from '@fortawesome/free-solid-svg-icons';

interface SidebarNavigationProps {
  selectedCategory: 'direct' | 'groups';
  invitationsCount: number;
  currentUser: { user_id: string; username: string; is_admin?: boolean } | null;
  isMobile: boolean;
  isSidebarVisible: boolean;
  isConversationsSidebarHidden: boolean;
  onCategoryChange: (category: 'direct' | 'groups') => void;
  onNewAction: () => void;
  onInvitationsClick: () => void;
  setIsConversationsSidebarHidden: (hidden: boolean) => void;
}

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  selectedCategory,
  invitationsCount,
  currentUser,
  isMobile,
  isSidebarVisible,
  isConversationsSidebarHidden,
  onCategoryChange,
  onNewAction,
  onInvitationsClick,
  setIsConversationsSidebarHidden
}) => {
  return (
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
        
        {/* Catalogue Navigation */}
        <div 
          className="w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={() => window.location.href = '/catalogue'}
          title="Catalogue"
        >
          <FontAwesomeIcon icon={faBookmark} />
        </div>
        
        {/* First Separator */}
        <div className="w-8 h-px bg-white mx-auto"></div>
        
        {/* Direct Messages Category */}
        <div 
          className={`w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
            selectedCategory === 'direct' ? 'bg-white text-black' : ''
          }`}
          onClick={() => onCategoryChange('direct')}
          title="Direct Messages"
        >
          <FontAwesomeIcon icon={faEnvelope} />
        </div>
        
        {/* Groups Category */}
        <div 
          className={`w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
            selectedCategory === 'groups' ? 'bg-white text-black' : ''
          }`}
          onClick={() => onCategoryChange('groups')}
          title="Groups"
        >
          <FontAwesomeIcon icon={faUsers} />
        </div>
        
        {/* Second Separator */}
        <div className="w-8 h-px bg-white mx-auto"></div>
        
        {/* Actions */}
        <div 
          className="w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={onNewAction}
          title={selectedCategory === 'direct' ? 'New Direct Message' : 'Create Group'}
        >
          <FontAwesomeIcon icon={faUserPlus} />
        </div>
        
        {/* Invitations */}
        <div 
          className="relative w-12 h-12 bg-black border border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={onInvitationsClick}
          title="Invitations"
        >
          <FontAwesomeIcon icon={faBell} />
          {invitationsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {invitationsCount}
            </span>
          )}
        </div>

        {/* Admin Dashboard */}
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
  );
};

export default SidebarNavigation;