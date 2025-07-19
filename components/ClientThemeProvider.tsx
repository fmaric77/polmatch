"use client";

import React, { ReactNode } from 'react';
import { ThemeProvider } from './ThemeProvider';

interface ClientThemeProviderProps {
  children: ReactNode;
}

const ClientThemeProvider: React.FC<ClientThemeProviderProps> = ({ children }) => {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
};

export default ClientThemeProvider;
