import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBell,
  faEnvelope,
  faSignOutAlt,
  faKey,
  faTimes,
  faComments,
  faCog,
} from '@fortawesome/free-solid-svg-icons';
import { useCSRFToken } from './hooks/useCSRFToken';
import { useTheme } from './ThemeProvider';
import { usePathname } from 'next/navigation';

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
  setIsConversationsSidebarHidden
}) => {
  const { protectedFetch } = useCSRFToken();
  const { theme } = useTheme();
  const pathname = usePathname() ?? '';
  const isOnChat = pathname.startsWith('/chat');
  const isOnProfile = pathname.startsWith('/profile');
  
  return (
    <div className={`${isMobile ? 'fixed left-0 top-0 z-50 h-full' : ''} ${isMinimized ? 'w-16' : 'w-20'} ${theme === 'dark' ? 'bg-black border-white' : 'bg-white border-black'} border rounded-lg flex flex-col h-full transition-all duration-300 ${
      isMobile ? (isSidebarVisible ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
    } ${isMinimized ? 'overflow-hidden' : ''}`}>
      {/* Header */}
      <div className={`border-b ${theme === 'dark' ? 'border-white bg-black' : 'border-black bg-white'} ${isMinimized ? 'p-1' : 'p-2'} transition-all duration-300`}>
      </div>
      
      <div className={`${isMinimized ? 'p-1 space-y-1' : 'p-2 space-y-2'} transition-all duration-300`}>
        {/* Messages (Unified) */}
        
        {/* Unified Messages (All Conversations) */}
        <div 
          className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} border ${theme === 'dark' ? 'border-white' : 'border-black'} rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300 ${
            (isOnChat && selectedCategory === 'unified')
              ? theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'
              : theme === 'dark' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-200'
          }`}
          onClick={() => {
            if (typeof window !== 'undefined' && !isOnChat) {
              window.location.href = '/chat';
              return;
            }
            onCategoryChange('unified');
          }}
          title="All Messages"
        >
          <FontAwesomeIcon icon={faComments} className="w-5 h-5 shrink-0" />
        </div>
        
        {/* Invitations */}
        <div 
          className={`relative ${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
          onClick={onInvitationsClick}
          title="Invitations"
        >
          <FontAwesomeIcon icon={faBell} className={`w-5 h-5 shrink-0 ${theme === 'dark' ? 'text-white' : 'text-black'}`} />
          {invitationsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {invitationsCount}
            </span>
          )}
        </div>

        {/* Settings */}
        <div 
          className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${
            isOnProfile
              ? (theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white')
              : (theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200')
          } border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/profile';
            }
          }}
          title="Settings"
        >
          <FontAwesomeIcon icon={faCog} className={`w-5 h-5 shrink-0 ${theme === 'dark' ? 'text-white' : 'text-black'}`} />
        </div>

  {/* Admin Dashboard (hidden on /chat) */}
  {currentUser?.is_admin && !isOnChat && (
          <div 
            className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/admindashboard';
              }
            }}
            title="Admin Dashboard"
          >
            <FontAwesomeIcon icon={faKey} className={`w-5 h-5 shrink-0 ${theme === 'dark' ? 'text-white' : 'text-black'}`} />
          </div>
        )}
        
        {/* Mobile Chat Sidebar Toggle */}
        {isMobile && (
          <div 
            className={`${isMinimized ? 'w-10 h-10' : 'w-12 h-12'} ${theme === 'dark' ? 'bg-black border-white hover:bg-gray-800' : 'bg-white border-black hover:bg-gray-200'} border rounded-lg flex items-center justify-center cursor-pointer transition-all duration-300`}
            onClick={() => {
              if (typeof window !== 'undefined' && !isOnChat) {
                window.location.href = '/chat';
                return;
              }
              setIsConversationsSidebarHidden(!isConversationsSidebarHidden);
            }}
            title={isOnChat ? (isConversationsSidebarHidden ? "Show Conversations" : "Hide Conversations") : 'Go to Chat'}
          >
            <FontAwesomeIcon 
              icon={!isOnChat ? faEnvelope : (isConversationsSidebarHidden ? faEnvelope : faTimes)} 
              className={`w-5 h-5 shrink-0 ${theme === 'dark' ? 'text-white' : 'text-black'}`}
            />
          </div>
        )}
      </div>
      
      {/* Bottom Navigation - Logout */}
      <div className={`mt-auto ${isMinimized ? 'p-1 pb-2 space-y-1' : 'p-2 pb-4 space-y-2'} transition-all duration-300`}>
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
          <FontAwesomeIcon icon={faSignOutAlt} className="w-5 h-5 shrink-0 text-red-300" />
        </div>
      </div>
    </div>
  );
};

export default SidebarNavigation;