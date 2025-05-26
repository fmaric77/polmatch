"use client";
import { Suspense, useEffect } from 'react';
import UnifiedMessages from '@/components/UnifiedMessages';
import Script from 'next/script';

export default function UnifiedMessagesPage() {
  useEffect(() => {
    // Add debug logging for this specific page
    console.log('🏠 Chat page mounted');
  }, []);

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <Script src="/debug-frontend.js" strategy="beforeInteractive" />
      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center bg-black text-white">
          <div className="text-xl">Loading messages...</div>
        </div>
      }>
        <UnifiedMessages />
      </Suspense>
    </div>
  );
}
