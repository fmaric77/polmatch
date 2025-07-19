"use client";
import { Suspense, useEffect } from 'react';
import UnifiedMessagesRefactored from '@/components/UnifiedMessagesRefactored';
import { SSEProvider } from '@/components/providers/SSEProvider';
import { useTheme } from '@/components/ThemeProvider';
import Script from 'next/script';

export default function UnifiedMessagesPage() {
  const { theme } = useTheme();
  
  useEffect(() => {
    // Add debug logging for this specific page
    console.log('🏠 Chat page mounted');
  }, []);

  return (
    <SSEProvider>
      <div className={`flex flex-col h-screen ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>
        <Script src="/debug-frontend.js" strategy="beforeInteractive" />
        <Suspense fallback={
          <div className={`flex-1 flex items-center justify-center ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`}>
            <div className="text-xl">Loading messages...</div>
          </div>
        }>
          <UnifiedMessagesRefactored />
        </Suspense>
      </div>
    </SSEProvider>
  );
}
