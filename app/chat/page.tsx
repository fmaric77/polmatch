"use client";
import { Suspense } from 'react';
import Header from '@/components/Header';
import UnifiedMessages from '@/components/UnifiedMessages';

export default function UnifiedMessagesPage() {
  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <Header />
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
