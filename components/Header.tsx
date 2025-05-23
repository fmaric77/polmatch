import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faHome, faUser, faSearch, faBook, faUsers, faSignOutAlt, faBars, faTimes } from '@fortawesome/free-solid-svg-icons';

const Header = () => {
  const [open, setOpen] = useState(true);

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
        <img src="/images/polstrat-dark.png" alt="Polstrat Logo" className="h-16 mb-8 drop-shadow-lg" />
        <nav className="w-full flex-1">
          <ul className="flex flex-col space-y-6 w-full px-4">
            <li>
              <a href="/messages" className="flex items-center p-2 rounded-lg hover:bg-gray-800/80 transition-colors group">
                <FontAwesomeIcon icon={faEnvelope} className="mr-3 text-blue-400 group-hover:text-blue-200 transition-colors" />
                <span className="font-medium">My Messages</span>
              </a>
            </li>
            <li>
              <a href="/" className="flex items-center p-2 rounded-lg hover:bg-gray-800/80 transition-colors group">
                <FontAwesomeIcon icon={faHome} className="mr-3 text-green-400 group-hover:text-green-200 transition-colors" />
                <span className="font-medium">Home Page</span>
              </a>
            </li>
            <li>
              <a href="/profile" className="flex items-center p-2 rounded-lg hover:bg-gray-800/80 transition-colors group">
                <FontAwesomeIcon icon={faUser} className="mr-3 text-yellow-400 group-hover:text-yellow-200 transition-colors" />
                <span className="font-medium">My Profile</span>
              </a>
            </li>
            <li>
              <a href="/search" className="flex items-center p-2 rounded-lg hover:bg-gray-800/80 transition-colors group">
                <FontAwesomeIcon icon={faSearch} className="mr-3 text-pink-400 group-hover:text-pink-200 transition-colors" />
                <span className="font-medium">Search Users</span>
              </a>
            </li>
            <li>
              <a href="/catalogs" className="flex items-center p-2 rounded-lg hover:bg-gray-800/80 transition-colors group">
                <FontAwesomeIcon icon={faBook} className="mr-3 text-purple-400 group-hover:text-purple-200 transition-colors" />
                <span className="font-medium">My Catalogs</span>
              </a>
            </li>
            <li>
              <a href="/groups" className="flex items-center p-2 rounded-lg hover:bg-gray-800/80 transition-colors group">
                <FontAwesomeIcon icon={faUsers} className="mr-3 text-cyan-400 group-hover:text-cyan-200 transition-colors" />
                <span className="font-medium">My Groups</span>
              </a>
            </li>
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
          <FontAwesomeIcon icon={faSignOutAlt} className="mr-3 text-red-400 group-hover:text-red-200 transition-colors" />
          <span className="font-medium">Logout</span>
        </button>
      </aside>
    </>
  );
};

export default Header;