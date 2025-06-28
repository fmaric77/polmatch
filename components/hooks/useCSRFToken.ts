import { useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { getCSRFToken, clearCSRFToken, preloadCSRFToken, csrfFetch } from '../../lib/csrf-client';

/**
 * React hook for CSRF token management
 */
export function useCSRFToken() {
  const pathname = usePathname();
  
  // Only preload CSRF token when we expect to have a session
  // Skip preloading on login page and other auth-related pages
  useEffect(() => {
    const isAuthPage = pathname === '/' || pathname === '/login' || pathname === '/register';
    if (!isAuthPage) {
      preloadCSRFToken();
    }
  }, [pathname]);

  // Get CSRF token
  const getToken = useCallback(async (): Promise<string> => {
    return await getCSRFToken();
  }, []);

  // Clear CSRF token
  const clearToken = useCallback((): void => {
    clearCSRFToken();
  }, []);

  // Enhanced fetch with CSRF protection
  const protectedFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    return await csrfFetch(url, options);
  }, []);

  return {
    getToken,
    clearToken,
    protectedFetch
  };
} 