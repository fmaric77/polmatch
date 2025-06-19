import { NextRequest } from 'next/server';
import crypto from 'crypto';

interface CSRFTokenData {
  token: string;
  expires: number;
  sessionId: string;
}

// In-memory storage for CSRF tokens (in production, use Redis or database)
const csrfTokens = new Map<string, CSRFTokenData>();

// CSRF token expiry time (1 hour)
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000;

/**
 * Generate a CSRF token for a session
 */
export function generateCSRFToken(sessionId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + CSRF_TOKEN_EXPIRY;
  
  csrfTokens.set(token, {
    token,
    expires,
    sessionId
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
  
  return true;
}

/**
 * Clean up expired CSRF tokens
 */
export function cleanupExpiredCSRFTokens(): void {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now > data.expires) {
      csrfTokens.delete(token);
    }
  }
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

// Cleanup expired tokens every 10 minutes
setInterval(cleanupExpiredCSRFTokens, 10 * 60 * 1000);
