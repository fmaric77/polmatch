"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GroupsRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new unified chat page
    router.replace('/chat');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <div className="text-center">
        <div className="text-xl mb-4">Redirecting to unified chat...</div>
        <div className="text-gray-400">Messages and Groups are now combined in a single interface</div>
      </div>
    </div>
  );
}
