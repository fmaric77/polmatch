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
    <div className={`${isMobile ? 'fixed left-0 top-0 z-50 h-full' : ''} w-20 bg-black border-2 border-white rounded-none shadow-2xl flex flex-col h-full transition-transform duration-300 ${
      isMobile ? (isSidebarVisible ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'
    }`}>
      {/* FBI Header */}
      <div className="border-b-2 border-white bg-white text-black p-2 text-center">
        <div className="font-mono text-xs font-bold tracking-widest">OPERATIONS</div>
      </div>
      
      <div className="p-2 space-y-3">
        {/* Home Navigation */}
        <div 
          className="w-14 h-14 bg-black border-2 border-white rounded-none shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-900 transition-colors"
          onClick={() => window.location.href = '/'}
          title="HOME BASE"
        >
          <FontAwesomeIcon icon={faHome} className="text-green-400 mb-1" />
          <div className="text-xs font-mono text-white">HOME</div>
        </div>
        
        {/* Profile Navigation */}
        <div 
          className="w-14 h-14 bg-black border-2 border-white rounded-none shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-900 transition-colors"
          onClick={() => window.location.href = '/profile'}
          title="AGENT DOSSIER"
        >
          <FontAwesomeIcon icon={faUser} className="text-yellow-400 mb-1" />
          <div className="text-xs font-mono text-white">FILE</div>
        </div>
        
        {/* Search Navigation */}
        <div 
          className="w-14 h-14 bg-black border-2 border-white rounded-none shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-900 transition-colors"
          onClick={() => window.location.href = '/search'}
          title="SUBJECT SEARCH"
        >
          <FontAwesomeIcon icon={faSearch} className="text-pink-400 mb-1" />
          <div className="text-xs font-mono text-white">SEARCH</div>
        </div>
        
        {/* Catalogue Navigation */}
        <div 
          className="w-14 h-14 bg-black border-2 border-white rounded-none shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-900 transition-colors"
          onClick={() => window.location.href = '/catalogue'}
          title="CLASSIFIED ARCHIVE"
        >
          <FontAwesomeIcon icon={faBookmark} className="text-purple-400 mb-1" />
          <div className="text-xs font-mono text-white">ARCHIVE</div>
        </div>
        
        {/* First Separator */}
        <div className="w-12 h-px bg-white mx-auto border-t border-white"></div>
        
        {/* Direct Messages Category */}
        <div 
          className={`w-14 h-14 border-2 border-white rounded-none shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-900 transition-colors ${
            selectedCategory === 'direct' ? 'bg-white text-black' : 'bg-black text-white'
          }`}
          onClick={() => onCategoryChange('direct')}
          title="DIRECT CHANNELS"
        >
          <FontAwesomeIcon icon={faEnvelope} className={`mb-1 ${selectedCategory === 'direct' ? 'text-blue-600' : 'text-blue-400'}`} />
          <div className="text-xs font-mono font-bold">DIRECT</div>
        </div>
        
        {/* Groups Category */}
        <div 
          className={`w-14 h-14 border-2 border-white rounded-none shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-900 transition-colors ${
            selectedCategory === 'groups' ? 'bg-white text-black' : 'bg-black text-white'
          }`}
          onClick={() => onCategoryChange('groups')}
          title="GROUP OPERATIONS"
        >
          <FontAwesomeIcon icon={faUsers} className={`mb-1 ${selectedCategory === 'groups' ? 'text-cyan-600' : 'text-cyan-400'}`} />
          <div className="text-xs font-mono font-bold">GROUPS</div>
        </div>
        
        {/* Second Separator */}
        <div className="w-12 h-px bg-white mx-auto border-t border-white"></div>
        
        {/* Actions */}
        <div 
          className="w-14 h-14 bg-green-900 border-2 border-green-700 rounded-none shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-green-800 transition-colors"
          onClick={onNewAction}
          title={selectedCategory === 'direct' ? 'NEW SECURE CHANNEL' : 'CREATE OPERATION'}
        >
          <FontAwesomeIcon icon={faUserPlus} className="text-green-200 mb-1" />
          <div className="text-xs font-mono font-bold text-green-200">NEW</div>
        </div>
        
        {/* Invitations */}
        <div 
          className="relative w-14 h-14 bg-blue-900 border-2 border-blue-700 rounded-none shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-blue-800 transition-colors"
          onClick={onInvitationsClick}
          title="PENDING CLEARANCES"
        >
          <FontAwesomeIcon icon={faBell} className="text-blue-200 mb-1" />
          <div className="text-xs font-mono font-bold text-blue-200">ALERTS</div>
          {invitationsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-mono font-bold rounded-none h-5 w-5 flex items-center justify-center border border-white">
              {invitationsCount}
            </span>
          )}
        </div>

        {/* Admin Dashboard */}
        {currentUser?.is_admin && (
          <div 
            className="w-14 h-14 bg-red-900 border-2 border-red-700 rounded-none shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-red-800 transition-colors"
            onClick={() => window.location.href = '/admindashboard'}
            title="COMMAND CENTER"
          >
            <FontAwesomeIcon icon={faKey} className="text-red-200 mb-1" />
            <div className="text-xs font-mono font-bold text-red-200">ADMIN</div>
          </div>
        )}
        
        {/* Mobile Chat Sidebar Toggle */}
        {isMobile && (
          <div 
            className="w-14 h-14 bg-gray-800 border-2 border-gray-600 rounded-none shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors"
            onClick={() => setIsConversationsSidebarHidden(!isConversationsSidebarHidden)}
            title={isConversationsSidebarHidden ? "SHOW COMMS" : "HIDE COMMS"}
          >
            <FontAwesomeIcon 
              icon={isConversationsSidebarHidden ? faEnvelope : faTimes} 
              className={`mb-1 ${isConversationsSidebarHidden ? "text-white" : "text-red-400"}`}
            />
            <div className={`text-xs font-mono font-bold ${isConversationsSidebarHidden ? "text-white" : "text-red-400"}`}>
              {isConversationsSidebarHidden ? "SHOW" : "HIDE"}
            </div>
          </div>
        )}
      </div>
      
      {/* Bottom Navigation - Logout */}
      <div className="mt-auto p-2 pb-4">
        <div 
          className="w-14 h-14 bg-red-900 border-2 border-red-500 rounded-none shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-red-800 transition-colors"
          onClick={async () => {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/';
          }}
          title="TERMINATE SESSION"
        >
          <FontAwesomeIcon icon={faSignOutAlt} className="text-red-300 mb-1" />
          <div className="text-xs font-mono font-bold text-red-300">EXIT</div>
        </div>
      </div>
    </div>
  );
};

export default SidebarNavigation;