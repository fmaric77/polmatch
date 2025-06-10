"use client";

import React from 'react';
import Navigation from '@/components/Navigation';
import Friends from '@/components/Friends';

export default function FriendsPage() {
  return (
    <div className="w-screen h-screen min-h-screen min-w-full bg-black text-white overflow-hidden">
      <div className="flex h-full">
        <Navigation currentPage="friends" />
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4">
            <Friends />
          </div>
        </div>
      </div>
    </div>
  );
}
