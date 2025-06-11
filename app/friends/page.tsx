"use client";

import React from 'react';
import Navigation from '@/components/Navigation';
import Friends from '@/components/Friends';

export default function FriendsPage() {
  return (
    <div className="flex h-screen bg-black text-white">
      <Navigation currentPage="friends" />
      <main className="flex-1 flex flex-col overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto mt-2 md:mt-4 lg:mt-8 p-2 md:p-4 lg:p-6 pb-8">
          <Friends />
        </div>
      </main>
    </div>
  );
}
