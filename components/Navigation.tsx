"use client";

import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHome, 
  faUser, 
  faSearch, 
  faEnvelope, 
  faSignOutAlt,
  faKey,
  faUsers,
  faBookmark,
  faBriefcase
} from '@fortawesome/free-solid-svg-icons';
import { usePathname } from 'next/navigation';

interface NavigationProps {
  currentPage?: string;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch('/api/session');
        const data = await res.json();
        setIsAdmin(!!(data.valid && data.user && data.user.is_admin));
      } catch {
        setIsAdmin(false);
      }
    }
    checkAdmin();
  }, []);

  const isActive = (page: string): boolean => {
    if (currentPage) return currentPage === page;
    return pathname === `/${page}` || (page === 'frontpage' && pathname === '/frontpage');
  };

  return (
    <div className="w-16 bg-black flex flex-col border-r border-white h-full">
      <div className="p-2 space-y-2">
        {/* Home Navigation */}
        <div 
          className={`w-12 h-12 bg-black border border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
            isActive('frontpage') ? 'bg-white text-black' : ''
          }`}
          onClick={() => window.location.href = '/frontpage'}
          title="Home"
        >
          <FontAwesomeIcon icon={faHome} />
        </div>
        
        {/* Profile Navigation */}
        <div 
          className={`w-12 h-12 bg-black border border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
            isActive('profile') ? 'bg-white text-black' : ''
          }`}
          onClick={() => window.location.href = '/profile'}
          title="Profile"
        >
          <FontAwesomeIcon icon={faUser} />
        </div>
        
        {/* Search Navigation */}
        <div 
          className={`w-12 h-12 bg-black border border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
            isActive('search') ? 'bg-white text-black' : ''
          }`}
          onClick={() => window.location.href = '/search'}
          title="Search Users"
        >
          <FontAwesomeIcon icon={faSearch} />
        </div>
        
        {/* Catalogue Navigation */}
        <div 
          className={`w-12 h-12 bg-black border border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
            isActive('catalogue') ? 'bg-white text-black' : ''
          }`}
          onClick={() => window.location.href = '/catalogue'}
          title="Catalogue"
        >
          <FontAwesomeIcon icon={faBookmark} />
        </div>
        
        {/* Jobs Navigation */}
        <div 
          className={`w-12 h-12 bg-black border border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
            isActive('jobs') ? 'bg-white text-black' : ''
          }`}
          onClick={() => window.location.href = '/jobs'}
          title="Jobs"
        >
          <FontAwesomeIcon icon={faBriefcase} />
        </div>
        
        {/* Separator */}
        <div className="w-8 h-px bg-white mx-auto"></div>
        
        {/* Chat Navigation */}
        <div 
          className={`w-12 h-12 bg-black border border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
            isActive('chat') ? 'bg-white text-black' : ''
          }`}
          onClick={() => window.location.href = '/chat'}
          title="Chat"
        >
          <FontAwesomeIcon icon={faEnvelope} />
        </div>

        {/* Discover Groups Navigation */}
        <div 
          className={`w-12 h-12 bg-black border border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
            isActive('discover-groups') ? 'bg-white text-black' : ''
          }`}
          onClick={() => window.location.href = '/discover-groups'}
          title="Discover Groups"
        >
          <FontAwesomeIcon icon={faUsers} />
        </div>

        {/* Admin Dashboard */}
        {isAdmin && (
          <div 
            className={`w-12 h-12 bg-black border border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors ${
              isActive('admindashboard') ? 'bg-white text-black' : ''
            }`}
            onClick={() => window.location.href = '/admindashboard'}
            title="Admin Dashboard"
          >
            <FontAwesomeIcon icon={faKey} />
          </div>
        )}
      </div>
      
      {/* Bottom Navigation - Logout */}
      <div className="mt-auto p-2 pb-4">
        <div 
          className="w-12 h-12 bg-red-900 border border-red-500 rounded-none flex items-center justify-center cursor-pointer hover:bg-red-800 transition-colors"
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

export default Navigation;
