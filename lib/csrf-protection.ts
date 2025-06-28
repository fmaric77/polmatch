import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import CryptoJS from 'crypto-js';

/*
  Stateless CSRF protection --------------------------------------------------
  A cryptographically-signed token includes:
    sessionId :  The user session this token belongs to
    expires   :  Absolute expiry timestamp (ms)
    mac       :  HMAC-SHA256(sessionId:expires, secret)
  The token is base64url-encoded so it is safe for HTTP headers.
  Because the token is self-validating we do *not* need any server-side cache
  and the logic works in development, serverless, edge and multi-process envs.
*/

const TOKEN_TTL_MS = 30 * 60 * 1000;     // 30 minutes
const CSRF_SECRET = process.env.CSRF_SECRET || 'dev-secret';

function b64uEncode(str: string): string {
  return Buffer.from(str, 'utf8').toString('base64url');
}
function b64uDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function hmac(payload: string): string {
  return CryptoJS.HmacSHA256(payload, CSRF_SECRET).toString(CryptoJS.enc.Hex);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) {
    res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return res === 0;
}

export function generateCSRFToken(sessionId: string): string {
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = `${sessionId}:${expires}`;
  const mac = hmac(payload);
  return b64uEncode(`${payload}:${mac}`);
}

export function validateCSRFToken(token: string, sessionId: string): boolean {
  let decoded: string;
  try {
    decoded = b64uDecode(token);
  } catch {
    return false;
  }

  const [sid, expStr, mac] = decoded.split(':');
  if (!sid || !expStr || !mac) return false;
  if (sid !== sessionId) return false;

  const exp = Number(expStr);
  if (!exp || Date.now() > exp) return false;

  const expectedMac = hmac(`${sid}:${exp}`);
  return safeEqual(mac, expectedMac);
}

/* ------------------------------------------------------------------------- */

export function checkCSRFToken(request: NextRequest): { valid: boolean; error?: string } {
  const method = request.method;

  // Only protect state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return { valid: true };
  }

  // Skip CSRF for some public endpoints
  const pathname = request.nextUrl.pathname;
  const skip = [
    '/api/login',
    '/api/auth/register',
    '/api/logout',
    '/api/session',
    '/api/internal/',
    '/api/csrf-token',
    '/api/sse',
    '/api/users/profile-pictures-batch'
  ];
  if (skip.some(p => pathname.startsWith(p))) {
    return { valid: true };
  }

  const csrfToken = request.headers.get('x-csrf-token');
  if (!csrfToken) return { valid: false, error: 'CSRF token missing' };

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return { valid: false, error: 'Session cookie missing' };

  const m = cookieHeader.match(/session=([^;]+)/);
  if (!m) return { valid: false, error: 'Session token missing' };
  const sessionId = m[1];

  if (!validateCSRFToken(csrfToken, sessionId)) {
    return { valid: false, error: 'Invalid CSRF token' };
  }

  return { valid: true };
}

export async function handleCSRFTokenRequest(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;
  if (!sessionToken) {
    // Return 200 with session status instead of 401 to prevent browser console errors
    return NextResponse.json({ 
      hasSession: false, 
      error: 'No session found' 
    }, { status: 200 });
  }

  const csrfToken = generateCSRFToken(sessionToken);
  return NextResponse.json({ 
    hasSession: true,
    csrfToken, 
    expires: Date.now() + TOKEN_TTL_MS 
  });
}

export function createCSRFErrorResponse(error: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message: 'CSRF validation failed',
      error
    },
    {
      status: 403,
      headers: { 'X-CSRF-Error': error }
    }
  );
}
