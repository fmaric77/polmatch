"use client";
import Navigation from '@/components/Navigation';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const WorldMap = dynamic(() => import('../../components/WorldMap'), { ssr: false });

function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

export default function Forum() {
  const router = useRouter();

  useEffect(() => {
    // Check WebGL support and redirect if not available
    if (!checkWebGLSupport()) {
      router.push('/search');
      return;
    }
  }, [router]);

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