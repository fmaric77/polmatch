/**
 * Client-side CSRF token management
 */

let csrfToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Fetch a new CSRF token from the server
 */
async function fetchCSRFToken(): Promise<string> {
  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.status}`);
    }

    const data = await response.json();
    
    // Check if session exists using response body instead of status code
    if (data.hasSession === false) {
      console.debug('No session found for CSRF token - this is expected during registration');
      throw new Error('NO_SESSION');
    }
    
    csrfToken = data.csrfToken;
    tokenExpiry = data.expires;
    
    if (!csrfToken) {
      throw new Error('Invalid CSRF token received from server');
    }
    
    return csrfToken;
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_SESSION') {
      // Re-throw with specific error type for handling
      throw error;
    }
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
}

/**
 * Get a valid CSRF token (fetch new one if expired)
 */
export async function getCSRFToken(): Promise<string> {
  // Check if we have a valid token
  if (csrfToken && Date.now() < tokenExpiry - 60000) { // 1 minute buffer
    return csrfToken;
  }

  // Fetch a new token
  return await fetchCSRFToken();
}

/**
 * Enhanced fetch function with automatic CSRF token handling
 */
export async function csrfFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = options.method?.toUpperCase() || 'GET';
  
  // Only add CSRF token for state-changing methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    try {
      const token = await getCSRFToken();
      
      // Add CSRF token to headers
      const headers = new Headers(options.headers);
      headers.set('x-csrf-token', token);
      
      options = {
        ...options,
        headers,
        credentials: 'include' // Ensure cookies are sent
      };
      
      // Make the request
      const response = await fetch(url, options);
      
      // If CSRF failed due to server restart, retry once with fresh token
      if (response.status === 403) {
        // Clone the response before reading so that callers can still consume the body later
        const clonedResponse = response.clone();
        const errorData = await clonedResponse.json().catch(() => ({}));
        if (errorData.error?.includes('CSRF token cache empty') || 
            errorData.error?.includes('server may have restarted') ||
            errorData.error?.includes('development hot-reload detected')) {
          console.log('CSRF cache was cleared, retrying with fresh token...');
          
          // Clear our cached token and get a fresh one
          clearCSRFToken();
          const freshToken = await getCSRFToken();
          
          // Update headers with fresh token
          const freshHeaders = new Headers(options.headers);
          freshHeaders.set('x-csrf-token', freshToken);
          
          // Retry the request
          return fetch(url, {
            ...options,
            headers: freshHeaders
          });
        }
      }
      
      return response;
      
    } catch (error) {
      if (error instanceof Error && error.message === 'NO_SESSION') {
        console.debug('No session available for CSRF token - proceeding without CSRF protection');
        // Don't add CSRF token, but ensure credentials are included for session creation
        options = {
          ...options,
          credentials: 'include'
        };
      } else {
        console.error('Failed to get CSRF token:', error);
        // Continue without CSRF token - let server handle the error
      }
    }
  }

  return fetch(url, options);
}

/**
 * Clear cached CSRF token (useful for logout)
 */
export function clearCSRFToken(): void {
  csrfToken = null;
  tokenExpiry = 0;
}

/**
 * Preload CSRF token for better UX
 */
export async function preloadCSRFToken(): Promise<void> {
  try {
    await getCSRFToken();
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_SESSION') {
      console.debug('No session available for CSRF token preload - this is normal during registration');
    } else {
      console.warn('Failed to preload CSRF token:', error);
    }
  }
} 