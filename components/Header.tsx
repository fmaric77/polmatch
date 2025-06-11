"use client";

import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faHome, faUser, faSearch, faSignOutAlt, faBars, faTimes, faUserFriends } from '@fortawesome/free-solid-svg-icons';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Header = () => {
  const [open, setOpen] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch('/api/session');
        const data = await res.json();
        setIsAdmin(!!(data.valid && data.user && data.user.is_admin));
        setUsername(data.user?.username || null);
      } catch {
        setIsAdmin(false);
        setUsername(null);
      }
    }
    checkAdmin();
  }, []);

  // Auto-close sidebar when navigating to chat page
  useEffect(() => {
    if (pathname === '/chat') {
      setOpen(false);
    }
  }, [pathname]);

  return (
    <>
      {/* Toggle button with shadow and smooth movement */}
      <button
        className={`fixed top-4 left-4 z-50 p-2 rounded-full bg-black/80 text-white border border-white shadow-lg transition-all duration-300 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-white ${open ? 'ml-64' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Hide sidebar' : 'Show sidebar'}
        style={{ boxShadow: '0 4px 24px 0 rgba(0,0,0,0.25)' }}
      >
        <FontAwesomeIcon icon={open ? faTimes : faBars} size="lg" />
      </button>
      {/* Sidebar with blur, drop shadow, and smooth slide */}
      <aside
        className={`h-screen w-64 bg-black/80 backdrop-blur-md text-white flex flex-col items-center py-8 border-r-2 border-white fixed top-0 left-0 z-40 transition-transform duration-500 ease-in-out shadow-2xl ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ boxShadow: open ? '4px 0 32px 0 rgba(0,0,0,0.35)' : 'none' }}
      >
        <Image src="/images/polstrat-dark.png" alt="Polstrat Logo" className="h-16 mb-8 drop-shadow-lg" width={128} height={48} />
        <nav className="w-full flex-1">
          <ul className="flex flex-col space-y-6 w-full px-4">
            <li>
              <a href="/chat" className="flex items-center p-2 rounded-lg hover:bg-gray-800/80 transition-colors group">
                <FontAwesomeIcon icon={faEnvelope} size="lg" style={{ width: '1.25em', height: '1.25em', minWidth: '1.25em', minHeight: '1.25em' }} className="mr-3 text-blue-400 group-hover:text-blue-200 transition-colors" />
                <span className="font-medium">Chat</span>
              </a>
            </li>
            <li>
              <Link href="/" className="flex items-center p-2 rounded-lg hover:bg-gray-800/80 transition-colors group">
                <FontAwesomeIcon icon={faHome} size="lg" style={{ width: '1.25em', height: '1.25em', minWidth: '1.25em', minHeight: '1.25em' }} className="mr-3 text-green-400 group-hover:text-green-200 transition-colors" />
                <span className="font-medium">Home Page</span>
              </Link>
            </li>
            <li>
              <a href="/profile" className="flex items-center p-2 rounded-lg hover:bg-gray-800/80 transition-colors group">
                <FontAwesomeIcon icon={faUser} size="lg" style={{ width: '1.25em', height: '1.25em', minWidth: '1.25em', minHeight: '1.25em' }} className="mr-3 text-yellow-400 group-hover:text-yellow-200 transition-colors" />
                <span className="font-medium">My Profile</span>
              </a>
            </li>
            <li>
              <a href="/search" className="flex items-center p-2 rounded-lg hover:bg-gray-800/80 transition-colors group">
                <FontAwesomeIcon icon={faSearch} size="lg" style={{ width: '1.25em', height: '1.25em', minWidth: '1.25em', minHeight: '1.25em' }} className="mr-3 text-pink-400 group-hover:text-pink-200 transition-colors" />
                <span className="font-medium">Search Users</span>
              </a>
            </li>
            <li>
              <a href="/friends" className="flex items-center p-2 rounded-lg hover:bg-gray-800/80 transition-colors group">
                <FontAwesomeIcon icon={faUserFriends} size="lg" style={{ width: '1.25em', height: '1.25em', minWidth: '1.25em', minHeight: '1.25em' }} className="mr-3 text-purple-400 group-hover:text-purple-200 transition-colors" />
                <span className="font-medium">Friends & Requests</span>
              </a>
            </li>
            {isAdmin && (
              <li>
                <a href="/admindashboard" className="flex items-center p-2 rounded-lg hover:bg-gray-800/80 transition-colors group">
                  <span className="mr-3 text-red-400 group-hover:text-red-200 transition-colors" style={{ width: '1.25em', height: '1.25em', minWidth: '1.25em', minHeight: '1.25em', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 inline">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118A7.5 7.5 0 0112 15.75a7.5 7.5 0 017.5 4.368M18 21v-2.25A2.25 2.25 0 0015.75 16.5h-7.5A2.25 2.25 0 006 18.75V21" />
                    </svg>
                  </span>
                  <span className="font-medium">Admin Dashboard</span>
                </a>
              </li>
            )}
          </ul>
        </nav>
        {/* Logout button in sidebar */}
        <button
          className="flex items-center p-2 mt-8 rounded-lg hover:bg-gray-800/80 transition-colors group w-full justify-center"
          onClick={async (e) => {
            e.preventDefault();
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/';
          }}
        >
          <FontAwesomeIcon icon={faSignOutAlt} size="lg" style={{ width: '1.25em', height: '1.25em', minWidth: '1.25em', minHeight: '1.25em' }} className="mr-3 text-red-400 group-hover:text-red-200 transition-colors" />
          <span className="font-medium">Logout</span>
        </button>
      </aside>
    </>
  );
};

export default Header;