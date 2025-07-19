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
import { useCSRFToken } from './hooks/useCSRFToken';
import { useTheme } from './ThemeProvider';

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
  const { protectedFetch } = useCSRFToken();
  const { theme } = useTheme();
  
  return (
    <div className={`${isMobile ? 'fixed left-0 top-0 z-50 h-full' : ''} w-20 ${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border rounded-lg flex flex-col h-full transition-transform duration-300 ${
      isMobile ? (isSidebarVisible ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
    }`}>
      {/* Header */}
      <div className={`border-b ${theme === 'dark' ? 'border-white bg-white/5' : 'border-black bg-black/5'} p-2`}>
      </div>
      
      <div className="p-2 space-y-2">
        {/* Home Navigation */}
        <div 
          className={`w-12 h-12 ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-colors`}
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }}
          title="Home"
        >
          <FontAwesomeIcon icon={faHome} className={theme === 'dark' ? 'text-white' : 'text-black'} />
        </div>
        
        {/* Profile Navigation */}
        <div 
          className={`w-12 h-12 ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-colors`}
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/profile';
            }
          }}
          title="Profile"
        >
          <FontAwesomeIcon icon={faUser} className={theme === 'dark' ? 'text-white' : 'text-black'} />
        </div>
        
        {/* Search Navigation */}
        <div 
          className={`w-12 h-12 ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-colors`}
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/search';
            }
          }}
          title="Search"
        >
          <FontAwesomeIcon icon={faSearch} className={theme === 'dark' ? 'text-white' : 'text-black'} />
        </div>
        
        {/* Catalogue Navigation */}
        <div 
          className={`w-12 h-12 ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-colors`}
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/catalogue';
            }
          }}
          title="Catalogue"
        >
          <FontAwesomeIcon icon={faBookmark} className={theme === 'dark' ? 'text-white' : 'text-black'} />
        </div>
        
        {/* Jobs Navigation */}
        <div 
          className={`w-12 h-12 ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-colors`}
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/jobs';
            }
          }}
          title="Jobs"
        >
          <FontAwesomeIcon icon={faBriefcase} className={theme === 'dark' ? 'text-white' : 'text-black'} />
        </div>
        
        {/* Discover Groups Navigation */}
        <div 
          className={`w-12 h-12 ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-colors`}
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/discover-groups';
            }
          }}
          title="Discover Groups"
        >
          <FontAwesomeIcon icon={faCompass} className={theme === 'dark' ? 'text-white' : 'text-black'} />
        </div>
        
        {/* Separator */}
        <div className={`w-8 h-px ${theme === 'dark' ? 'bg-white' : 'bg-black'} mx-auto`}></div>
        
        {/* Direct Messages Category */}
        <div 
          className={`w-12 h-12 border ${theme === 'dark' ? 'border-white' : 'border-black'} rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
            selectedCategory === 'direct' 
              ? theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'
              : theme === 'dark' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-200'
          }`}
          onClick={() => onCategoryChange('direct')}
          title="Direct Messages"
        >
          <FontAwesomeIcon icon={faEnvelope} />
        </div>
        
        {/* Groups Category */}
        <div 
          className={`w-12 h-12 border ${theme === 'dark' ? 'border-white' : 'border-black'} rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
            selectedCategory === 'groups' 
              ? theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'
              : theme === 'dark' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-200'
          }`}
          onClick={() => onCategoryChange('groups')}
          title="Groups"
        >
          <FontAwesomeIcon icon={faUsers} />
        </div>
        
        {/* Separator */}
        <div className={`w-8 h-px ${theme === 'dark' ? 'bg-white' : 'bg-black'} mx-auto`}></div>
        
        {/* New Action */}
        <div 
          className={`w-12 h-12 ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-colors`}
          onClick={onNewAction}
          title={selectedCategory === 'direct' ? 'New Message' : 'Create Group'}
        >
          <FontAwesomeIcon icon={selectedCategory === 'direct' ? faPlus : faUserPlus} className={theme === 'dark' ? 'text-white' : 'text-black'} />
        </div>
        
        {/* Invitations */}
        <div 
          className={`relative w-12 h-12 ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-colors`}
          onClick={onInvitationsClick}
          title="Invitations"
        >
          <FontAwesomeIcon icon={faBell} className={theme === 'dark' ? 'text-white' : 'text-black'} />
          {invitationsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {invitationsCount}
            </span>
          )}
        </div>

        {/* Admin Dashboard */}
        {currentUser?.is_admin && (
          <div 
            className={`w-12 h-12 ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-colors`}
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/admindashboard';
              }
            }}
            title="Admin Dashboard"
          >
            <FontAwesomeIcon icon={faKey} className={theme === 'dark' ? 'text-white' : 'text-black'} />
          </div>
        )}
        
        {/* Mobile Chat Sidebar Toggle */}
        {isMobile && (
          <div 
            className={`w-12 h-12 ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-colors`}
            onClick={() => setIsConversationsSidebarHidden(!isConversationsSidebarHidden)}
            title={isConversationsSidebarHidden ? "Show Conversations" : "Hide Conversations"}
          >
            <FontAwesomeIcon 
              icon={isConversationsSidebarHidden ? faEnvelope : faTimes} 
              className={theme === 'dark' ? 'text-white' : 'text-black'}
            />
          </div>
        )}
      </div>
      
      {/* Bottom Navigation - Logout */}
      <div className="mt-auto p-2 pb-4">
        <div 
          className="w-12 h-12 bg-red-900 border border-red-500 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-800 transition-colors"
          onClick={async () => {
            await protectedFetch('/api/logout', { method: 'POST' });
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