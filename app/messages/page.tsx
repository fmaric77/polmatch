"use client";
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

function Redirector(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const user = searchParams?.get('user');
    const profile = searchParams?.get('profile');
    const query = new URLSearchParams();
    if (user) query.set('user', user);
    if (profile) query.set('profile', profile);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    router.replace(`/chat${suffix}`);
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <div className="text-center">
        <div className="text-xl mb-4">Redirecting to unified chat...</div>
        <div className="text-gray-400">Messages and Groups are now combined in a single interface</div>
      </div>
    </div>
  );
}

export default function MessagesRedirect(): JSX.Element {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center">
          <div className="text-xl mb-4">Redirecting to unified chat...</div>
          <div className="text-gray-400">Messages and Groups are now combined in a single interface</div>
        </div>
      </div>
    }>
      <Redirector />
    </Suspense>
  );
}