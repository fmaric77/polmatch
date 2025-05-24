"use client";
import Header from '@/components/Header';
import UnifiedMessages from '@/components/UnifiedMessages';

export default function UnifiedMessagesPage() {
  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <Header />
      <UnifiedMessages />
    </div>
  );
}
