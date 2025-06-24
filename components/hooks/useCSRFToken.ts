import { useEffect, useCallback } from 'react';
import { getCSRFToken, clearCSRFToken, preloadCSRFToken, csrfFetch } from '../../lib/csrf-client';

/**
 * React hook for CSRF token management
 */
export function useCSRFToken() {
  // Preload CSRF token when component mounts
  useEffect(() => {
    preloadCSRFToken();
  }, []);

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