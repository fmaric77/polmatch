"use client";
import Navigation from '@/components/Navigation';
import dynamic from 'next/dynamic';

const WorldMap = dynamic(() => import('../../components/WorldMap'), { ssr: false });

export default function Forum() {
  return (
    <div className="w-screen h-screen min-h-screen min-w-full bg-white dark:bg-black text-black dark:text-white overflow-hidden">
      <div className="flex h-full">
        <Navigation currentPage="frontpage" />
        <div className="flex-1 relative">
          <WorldMap />
        </div>
      </div>
    </div>
  );
}