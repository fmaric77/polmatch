import { NextRequest, NextResponse } from 'next/server';

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

// Check if IP address is banned using internal API
async function isIPBanned(ip_address: string, request: NextRequest): Promise<boolean> {
  if (ip_address === 'unknown') {
    return false; // Don't block unknown IPs
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
      return data.banned === true;
    }
    
    return false; // Don't block on API error
  } catch (error) {
    console.error('Error checking IP ban status:', error);
    return false; // Don't block on error
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  
  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    (pathname.includes('.') && !pathname.startsWith('/api/'))
  ) {
    return NextResponse.next();
  }
  
  // Skip only specific internal API routes that are needed for the ban check itself
  if (
    pathname === '/api/internal/check-ip-ban' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/_next/')
  ) {
    return NextResponse.next();
  }

  // Get client IP address
  const clientIP = getClientIP(request);
  
  // Check if IP is banned
  try {
    const isBanned = await isIPBanned(clientIP, request);
    
    if (isBanned) {
      // Return a 403 Forbidden response for banned IPs
      return new NextResponse(
        JSON.stringify({
          error: 'Access Denied',
          message: 'Your IP address has been banned from accessing this service.',
          code: 'IP_BANNED'
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error) {
    console.error('Middleware error:', error);
    // Continue to next() on error to avoid blocking legitimate users
  }

  return NextResponse.next();
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
