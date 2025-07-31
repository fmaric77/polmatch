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
  faBookmark,
  faBriefcase,
  faCompass
} from '@fortawesome/free-solid-svg-icons';
import { usePathname } from 'next/navigation';
import { useCSRFToken } from './hooks/useCSRFToken';

interface NavigationProps {
  currentPage?: string;
}

const Navigation: React.FC<NavigationProps> = ({ currentPage }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();
  const { protectedFetch } = useCSRFToken();

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

  const handleLogout = async () => {
    try {
      await protectedFetch('/api/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails, redirect to login page
      window.location.href = '/login';
    }
  };

  return (
    <div className="w-16 bg-white dark:bg-black flex flex-col border-r border-black dark:border-white h-full">
      <div className="p-2 space-y-2">
        {/* Home Navigation */}
        <div 
          className={`w-12 h-12 bg-white dark:bg-black border border-black dark:border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
            isActive('frontpage') ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-black dark:text-white'
          }`}
          onClick={() => window.location.href = '/frontpage'}
          title="Home"
        >
          <FontAwesomeIcon icon={faHome} />
        </div>
        
        {/* Profile Navigation */}
        <div 
          className={`w-12 h-12 bg-white dark:bg-black border border-black dark:border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
            isActive('profile') ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-black dark:text-white'
          }`}
          onClick={() => window.location.href = '/profile'}
          title="Profile"
        >
          <FontAwesomeIcon icon={faUser} />
        </div>
        
        {/* Search Navigation */}
        <div 
          className={`w-12 h-12 bg-white dark:bg-black border border-black dark:border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
            isActive('search') ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-black dark:text-white'
          }`}
          onClick={() => window.location.href = '/search'}
          title="Search Users"
        >
          <FontAwesomeIcon icon={faSearch} />
        </div>
        
        {/* Catalogue Navigation */}
        <div 
          className={`w-12 h-12 bg-white dark:bg-black border border-black dark:border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
            isActive('catalogue') ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-black dark:text-white'
          }`}
          onClick={() => window.location.href = '/catalogue'}
          title="Catalogue"
        >
          <FontAwesomeIcon icon={faBookmark} />
        </div>
        
        {/* Jobs Navigation */}
        <div 
          className={`w-12 h-12 bg-white dark:bg-black border border-black dark:border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
            isActive('jobs') ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-black dark:text-white'
          }`}
          onClick={() => window.location.href = '/jobs'}
          title="Jobs"
        >
          <FontAwesomeIcon icon={faBriefcase} />
        </div>
        
        {/* Separator */}
        <div className="w-8 h-px bg-black dark:bg-white mx-auto"></div>
        
        {/* Chat Navigation */}
        <div 
          className={`w-12 h-12 bg-white dark:bg-black border border-black dark:border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
            isActive('chat') ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-black dark:text-white'
          }`}
          onClick={() => window.location.href = '/chat'}
          title="Chat"
        >
          <FontAwesomeIcon icon={faEnvelope} />
        </div>

        {/* Discover Groups Navigation */}
        <div 
          className={`w-12 h-12 bg-white dark:bg-black border border-black dark:border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
            isActive('discover-groups') ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-black dark:text-white'
          }`}
          onClick={() => window.location.href = '/discover-groups'}
          title="Discover Groups"
        >
          <FontAwesomeIcon icon={faCompass} />
        </div>

        {/* Admin Dashboard */}
        {isAdmin && (
          <div 
            className={`w-12 h-12 bg-white dark:bg-black border border-black dark:border-white rounded-none flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors ${
              isActive('admindashboard') ? 'bg-black dark:bg-white text-white dark:text-black' : 'text-black dark:text-white'
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
          className="w-12 h-12 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-500 rounded-none flex items-center justify-center cursor-pointer hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
          onClick={handleLogout}
          title="Logout"
        >
          <FontAwesomeIcon icon={faSignOutAlt} className="text-red-600 dark:text-red-300" />
        </div>
      </div>
    </div>
  );
};

export default Navigation;
