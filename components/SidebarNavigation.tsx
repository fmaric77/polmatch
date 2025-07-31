import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUser,
  faSearch,
  faBell,
  faHome,
  faEnvelope,
  faSignOutAlt,
  faKey,
  faTimes,
  faBookmark,
  faBriefcase,
  faCompass,
  faComments,
  faChevronLeft,
  faChevronRight
} from '@fortawesome/free-solid-svg-icons';
import { useCSRFToken } from './hooks/useCSRFToken';
import { useTheme } from './ThemeProvider';

interface SidebarNavigationProps {
  selectedCategory: 'direct' | 'groups' | 'unified';
  invitationsCount: number;
  currentUser: { user_id: string; username: string; is_admin?: boolean } | null;
  isMobile: boolean;
  isSidebarVisible: boolean;
  isConversationsSidebarHidden: boolean;
  isMinimized: boolean;
  onCategoryChange: (category: 'unified') => void;
  onInvitationsClick: () => void;
  setIsConversationsSidebarHidden: (hidden: boolean) => void;
  setIsMinimized: (minimized: boolean) => void;
}

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  selectedCategory,
  invitationsCount,
  currentUser,
  isMobile,
  isSidebarVisible,
  isConversationsSidebarHidden,
  isMinimized,
  onCategoryChange,
  onInvitationsClick,
  setIsConversationsSidebarHidden,
  setIsMinimized
}) => {
  const { protectedFetch } = useCSRFToken();
  const { theme } = useTheme();
  
  return (
    <div className={`${isMobile ? 'fixed left-0 top-0 z-50 h-full' : ''} ${isMinimized ? 'w-16' : 'w-20'} ${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border rounded-lg flex flex-col h-full transition-all duration-300 ${
      isMobile ? (isSidebarVisible ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
    } ${isMinimized ? 'overflow-hidden' : ''}`}>
      {/* Header */}
      <div className={`border-b ${theme === 'dark' ? 'border-white bg-black' : 'border-black bg-white'} ${isMinimized ? 'p-1' : 'p-2'} transition-all duration-300`}>
      </div>
      
      <div className={`${isMinimized ? 'p-1 space-y-1' : 'p-2 space-y-2'} transition-all duration-300`}>
        {/* Home Navigation */}
        <div 
          className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
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
          className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
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
          className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
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
          className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
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
          className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
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
          className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
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
        
        {/* Unified Messages (All Conversations) */}
        <div 
          className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} border ${theme === 'dark' ? 'border-white' : 'border-black'} rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300 ${
            selectedCategory === 'unified' 
              ? theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'
              : theme === 'dark' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-200'
          }`}
          onClick={() => onCategoryChange('unified')}
          title="All Messages"
        >
          <FontAwesomeIcon icon={faComments} />
        </div>
        


        
        {/* Invitations */}
        <div 
          className={`relative ${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
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
            className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
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
            className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
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
      
      {/* Bottom Navigation - Minimize & Logout */}
      <div className={`mt-auto ${isMinimized ? 'p-1 pb-2 space-y-1' : 'p-2 pb-4 space-y-2'} transition-all duration-300`}>
        {/* Minimize Button */}
        <div 
          className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${theme === 'dark' ? 'bg-gray-800 border-gray-600 hover:bg-gray-700' : 'bg-gray-200 border-gray-400 hover:bg-gray-300'} border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
          onClick={() => setIsMinimized(!isMinimized)}
          title={isMinimized ? "Expand Sidebar" : "Minimize Sidebar"}
        >
          <FontAwesomeIcon 
            icon={isMinimized ? faChevronRight : faChevronLeft} 
            className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} 
          />
        </div>
        
        {/* Logout Button */}
        <div 
          className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} bg-red-900 border border-red-500 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-800 transition-all duration-300`}
          onClick={async () => {
            await protectedFetch('/api/logout', { method: 'POST' });
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
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