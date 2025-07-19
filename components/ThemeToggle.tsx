"use client";

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons';
import { useTheme } from './ThemeProvider';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="bg-white dark:bg-black border-2 border-black dark:border-white rounded-none p-6">
      <h2 className="text-xl font-bold mb-4">Appearance</h2>
      <button
        onClick={toggleTheme}
        className="flex items-center px-4 py-2 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors rounded-none"
      >
        <FontAwesomeIcon icon={theme === 'light' ? faMoon : faSun} className="mr-2" />
        {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
      </button>
    </div>
  );
};

export default ThemeToggle;
