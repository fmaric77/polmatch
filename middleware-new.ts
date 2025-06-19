import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for IP ban status
interface BanCacheEntry {
  banned: boolean;
  timestamp: number;
}

const banCache = new Map<string, BanCacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Helper function to get client IP address from request
function getClientIP(request: NextRequest): string {
  let ip_address = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('remote-addr') || 
                   'unknown';
  
  if (ip_address && ip_address.includes(',')) {
    ip_address = ip_address.split(',')[0].trim();
  }
  
  return ip_address;
}

// Security headers to add to all responses
function addSecurityHeaders(response: NextResponse): NextResponse {
  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // Clickjacking protection
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Content Security Policy
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' ws: wss:; " +
    "font-src 'self'; " +
    "object-src 'none'; " +
    "media-src 'self'; " +
    "frame-ancestors 'none';"
  );
  
  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Strict Transport Security (HTTPS only)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  return response;
}

// Check if cached entry is still valid
function isCacheValid(entry: BanCacheEntry): boolean {
  return (Date.now() - entry.timestamp) < CACHE_DURATION;
}

// Check if IP address is banned using internal API with caching
async function isIPBanned(ip_address: string, request: NextRequest): Promise<boolean> {
  if (ip_address === 'unknown') {
    return false; // Don't block unknown IPs
  }

  // Check cache first
  const cachedEntry = banCache.get(ip_address);
  if (cachedEntry && isCacheValid(cachedEntry)) {
    return cachedEntry.banned;
  }

  try {
    // Make internal API call to check ban status
    const url = new URL('/api/internal/check-ip-ban', request.url);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-request': 'true',
      },
      body: JSON.stringify({ ip_address }),
    });

    if (response.ok) {
      const data = await response.json();
      const banned = data.banned === true;
      
      // Cache the result
      banCache.set(ip_address, {
        banned,
        timestamp: Date.now()
      });
      
      return banned;
    }
    
    // On API error, cache as not banned for a shorter duration
    banCache.set(ip_address, {
      banned: false,
      timestamp: Date.now()
    });
    
    return false; // Don't block on API error
  } catch (error) {
    console.error('Error checking IP ban status:', error);
    
    // On error, cache as not banned for a shorter duration
    banCache.set(ip_address, {
      banned: false,
      timestamp: Date.now()
    });
    
    return false; // Don't block on error
  }
}

// Clean up expired cache entries periodically
function cleanupCache(): void {
  const now = Date.now();
  for (const [ip, entry] of banCache.entries()) {
    if (!isCacheValid(entry)) {
      banCache.delete(ip);
    }
  }
}

// Run cache cleanup every 10 minutes
if (typeof globalThis !== 'undefined') {
  setInterval(cleanupCache, 10 * 60 * 1000);
}

// Function to clear cache for specific IP (for immediate invalidation)
export function clearMiddlewareCache(ip_address: string): void {
  banCache.delete(ip_address);
  console.log(`Cleared middleware cache for IP: ${ip_address}`);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  
  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') && !pathname.startsWith('/api/') ||
    pathname.startsWith('/sounds/') // Skip audio files
  ) {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }
  
  // Skip only specific internal API routes that are needed for the ban check itself
  if (
    pathname === '/api/internal/check-ip-ban' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/_next/')
  ) {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  // Get client IP address
  const clientIP = getClientIP(request);

  // Skip ban check for localhost/development IPs
  if (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP.startsWith('192.168.') || clientIP.startsWith('10.') || clientIP === 'unknown') {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }

  // Check if IP is banned (with caching)
  const isBanned = await isIPBanned(clientIP, request);

  if (isBanned) {
    // Return a custom HTML page with skull emoji and autoplay audio
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>💀</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            background: #000;
            color: #fff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            font-family: Arial, sans-serif;
          }
          .skull {
            font-size: 8rem;
            margin-bottom: 2rem;
            text-shadow: 0 0 16px #fff;
          }
        </style>
      </head>
      <body>
        <div class="skull">💀</div>
        <audio src="/sounds/ww.mp3" autoplay loop></audio>
      </body>
      </html>
      `,
      {
        status: 403,
        headers: {
          'Content-Type': 'text/html',
          'X-XSS-Protection': '1; mode=block',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      }
    );
  }

  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/internal/check-ip-ban (our internal ban check API)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/internal/check-ip-ban).*)',
  ],
};
