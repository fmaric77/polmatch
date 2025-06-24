import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// CSRF token cache - in production you'd want to use Redis or database
const csrfTokens = new Map<string, {
  sessionId: string;
  expires: number;
  used: boolean;
}>();

// Token expiry time (30 minutes)
const TOKEN_EXPIRY = 30 * 60 * 1000;

// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Generate a secure CSRF token
 */
export function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + TOKEN_EXPIRY;
  
  csrfTokens.set(token, {
    sessionId,
    expires,
    used: false
  });
  
  return token;
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string, sessionId: string): boolean {
  const tokenData = csrfTokens.get(token);
  
  if (!tokenData) {
    return false;
  }
  
  // Check if token has expired
  if (Date.now() > tokenData.expires) {
    csrfTokens.delete(token);
    return false;
  }
  
  // Check if token belongs to the session
  if (tokenData.sessionId !== sessionId) {
    return false;
  }
  
  // Mark token as used (optional: implement one-time use)
  // tokenData.used = true;
  
  return true;
}

/**
 * Clean up expired tokens
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now > data.expires) {
      csrfTokens.delete(token);
    }
  }
}

// Set up periodic cleanup
if (typeof globalThis !== 'undefined') {
  setInterval(cleanupExpiredTokens, CLEANUP_INTERVAL);
}

/**
 * Middleware to check CSRF token for state-changing operations
 */
export function checkCSRFToken(request: NextRequest): { valid: boolean; error?: string } {
  const method = request.method;
  
  // Only check CSRF for state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return { valid: true };
  }
  
  // Skip CSRF check for certain endpoints
  const pathname = request.nextUrl.pathname;
  const skipCSRFPaths = [
    '/api/login',
    '/api/auth/register',
    '/api/logout',
    '/api/session',
    '/api/internal/',
    '/api/csrf-token',
    '/api/sse',
    '/api/users/profile-pictures-batch'
  ];
  
  if (skipCSRFPaths.some(path => pathname.startsWith(path))) {
    return { valid: true };
  }
  
  // Get CSRF token from header
  const csrfToken = request.headers.get('x-csrf-token');
  if (!csrfToken) {
    return { valid: false, error: 'CSRF token missing' };
  }
  
  // Get session ID from cookies
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return { valid: false, error: 'Session cookie missing' };
  }
  
  const sessionMatch = cookieHeader.match(/session=([^;]+)/);
  if (!sessionMatch) {
    return { valid: false, error: 'Session token missing' };
  }
  
  const sessionId = sessionMatch[1];
  
  if (!validateCSRFToken(csrfToken, sessionId)) {
    return { valid: false, error: 'Invalid CSRF token' };
  }
  
  return { valid: true };
}

/**
 * API handler to generate CSRF tokens
 */
export async function handleCSRFTokenRequest(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }
    
    const csrfToken = generateCSRFToken(sessionToken);
    
    return NextResponse.json({ 
      csrfToken,
      expires: Date.now() + TOKEN_EXPIRY
    });
  } catch (error) {
    console.error('Error generating CSRF token:', error);
    return NextResponse.json({ error: 'Failed to generate CSRF token' }, { status: 500 });
  }
}

/**
 * Helper function to create CSRF error response
 */
export function createCSRFErrorResponse(error: string): NextResponse {
  return NextResponse.json(
    { 
      success: false, 
      message: 'CSRF validation failed',
      error: error 
    }, 
    { 
      status: 403,
      headers: {
        'X-CSRF-Error': error
      }
    }
  );
}
