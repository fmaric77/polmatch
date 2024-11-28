import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faHome, faUser, faSearch, faBook, faUsers, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';

const Header = () => {
  return (
    <header className="w-full bg-black text-white py-4 flex justify-between items-center px-6 border-b-2 border-white">
      <img src="/images/polstrat-dark.png" alt="Polstrat Logo" className="h-12" />
      <nav>
        <ul className="flex space-x-4">
          <li className="relative group">
            <a href="/messages" className="flex items-center">
              <FontAwesomeIcon icon={faEnvelope} className="mr-2" />
              <span className="absolute left-0 ml-8 bg-gray-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">My Messages</span>
            </a>
          </li>
          <li className="relative group">
            <a href="/" className="flex items-center">
              <FontAwesomeIcon icon={faHome} className="mr-2" />
              <span className="absolute left-0 ml-8 bg-gray-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Home Page</span>
            </a>
          </li>
          <li className="relative group">
            <a href="/profile" className="flex items-center">
              <FontAwesomeIcon icon={faUser} className="mr-2" />
              <span className="absolute left-0 ml-8 bg-gray-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">My Profile</span>
            </a>
          </li>
          <li className="relative group">
            <a href="/search" className="flex items-center">
              <FontAwesomeIcon icon={faSearch} className="mr-2" />
              <span className="absolute left-0 ml-8 bg-gray-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">Search Users</span>
            </a>
          </li>
          <li className="relative group">
            <a href="/catalogs" className="flex items-center">
              <FontAwesomeIcon icon={faBook} className="mr-2" />
              <span className="absolute left-0 ml-8 bg-gray-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">My Catalogs</span>
            </a>
          </li>
          <li className="relative group">
            <a href="/groups" className="flex items-center">
              <FontAwesomeIcon icon={faUsers} className="mr-2" />
              <span className="absolute left-0 ml-8 bg-gray-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">My Groups</span>
            </a>
          </li>
        </ul>
      </nav>
      <a href="/logout" className="flex items-center">
        <FontAwesomeIcon icon={faSignOutAlt} className="mr-2" />
        <span className="hidden">Logout</span>
      </a>
    </header>
  );
};

export default Header;