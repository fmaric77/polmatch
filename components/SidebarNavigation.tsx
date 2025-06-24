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
  faBookmark,
  faBriefcase,
  faCompass,
  faPlus
} from '@fortawesome/free-solid-svg-icons';

interface SidebarNavigationProps {
  selectedCategory: 'direct' | 'groups';
  invitationsCount: number;
  currentUser: { user_id: string; username: string; is_admin?: boolean } | null;
  isMobile: boolean;
  isSidebarVisible: boolean;
  isConversationsSidebarHidden: boolean;
  activeProfileType: 'basic' | 'love' | 'business';
  onCategoryChange: (category: 'direct' | 'groups') => void;
  onNewAction: () => void;
  onInvitationsClick: () => void;
  onProfileTypeChange: (profileType: 'basic' | 'love' | 'business') => void;
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
    <div className={`${isMobile ? 'fixed left-0 top-0 z-50 h-full' : ''} w-20 bg-black border border-white rounded-lg flex flex-col h-full transition-transform duration-300 ${
      isMobile ? (isSidebarVisible ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
    }`}>
      {/* Header */}
      <div className="border-b border-white bg-white/5 p-2">
      </div>
      
      <div className="p-2 space-y-2">
        {/* Home Navigation */}
        <div 
          className="w-12 h-12 bg-black border border-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }}
          title="Home"
        >
          <FontAwesomeIcon icon={faHome} />
        </div>
        
        {/* Profile Navigation */}
        <div 
          className="w-12 h-12 bg-black border border-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/profile';
            }
          }}
          title="Profile"
        >
          <FontAwesomeIcon icon={faUser} />
        </div>
        
        {/* Search Navigation */}
        <div 
          className="w-12 h-12 bg-black border border-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/search';
            }
          }}
          title="Search"
        >
          <FontAwesomeIcon icon={faSearch} />
        </div>
        
        {/* Catalogue Navigation */}
        <div 
          className="w-12 h-12 bg-black border border-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/catalogue';
            }
          }}
          title="Catalogue"
        >
          <FontAwesomeIcon icon={faBookmark} />
        </div>
        
        {/* Jobs Navigation */}
        <div 
          className="w-12 h-12 bg-black border border-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/jobs';
            }
          }}
          title="Jobs"
        >
          <FontAwesomeIcon icon={faBriefcase} />
        </div>
        
        {/* Discover Groups Navigation */}
        <div 
          className="w-12 h-12 bg-black border border-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/discover-groups';
            }
          }}
          title="Discover Groups"
        >
          <FontAwesomeIcon icon={faCompass} />
        </div>
        
        {/* Separator */}
        <div className="w-8 h-px bg-white mx-auto"></div>
        
        {/* Direct Messages Category */}
        <div 
          className={`w-12 h-12 border border-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
            selectedCategory === 'direct' ? 'bg-white text-black' : 'bg-black text-white'
          }`}
          onClick={() => onCategoryChange('direct')}
          title="Direct Messages"
        >
          <FontAwesomeIcon icon={faEnvelope} />
        </div>
        
        {/* Groups Category */}
        <div 
          className={`w-12 h-12 border border-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
            selectedCategory === 'groups' ? 'bg-white text-black' : 'bg-black text-white'
          }`}
          onClick={() => onCategoryChange('groups')}
          title="Groups"
        >
          <FontAwesomeIcon icon={faUsers} />
        </div>
        
        {/* Separator */}
        <div className="w-8 h-px bg-white mx-auto"></div>
        
        {/* New Action */}
        <div 
          className="w-12 h-12 bg-black border border-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={onNewAction}
          title={selectedCategory === 'direct' ? 'New Message' : 'Create Group'}
        >
          <FontAwesomeIcon icon={selectedCategory === 'direct' ? faPlus : faUserPlus} />
        </div>
        
        {/* Invitations */}
        <div 
          className="relative w-12 h-12 bg-black border border-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={onInvitationsClick}
          title="Invitations"
        >
          <FontAwesomeIcon icon={faBell} />
          {invitationsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {invitationsCount}
            </span>
          )}
        </div>

        {/* Admin Dashboard */}
        {currentUser?.is_admin && (
          <div 
            className="w-12 h-12 bg-black border border-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/admindashboard';
              }
            }}
            title="Admin Dashboard"
          >
            <FontAwesomeIcon icon={faKey} />
          </div>
        )}
        
        {/* Mobile Chat Sidebar Toggle */}
        {isMobile && (
          <div 
            className="w-12 h-12 bg-black border border-white rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
            onClick={() => setIsConversationsSidebarHidden(!isConversationsSidebarHidden)}
            title={isConversationsSidebarHidden ? "Show Conversations" : "Hide Conversations"}
          >
            <FontAwesomeIcon 
              icon={isConversationsSidebarHidden ? faEnvelope : faTimes} 
            />
          </div>
        )}
      </div>
      
      {/* Bottom Navigation - Logout */}
      <div className="mt-auto p-2 pb-4">
        <div 
          className="w-12 h-12 bg-red-900 border border-red-500 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-800 transition-colors"
          onClick={async () => {
            await fetch('/api/logout', { method: 'POST' });
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
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