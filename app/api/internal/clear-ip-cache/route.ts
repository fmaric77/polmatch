import { NextRequest, NextResponse } from 'next/server';

// Cache invalidation API endpoint for clearing IP ban caches
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify this is an internal request
    const internalHeader = request.headers.get('x-internal-request');
    if (internalHeader !== 'true') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ip_address } = await request.json();
    
    if (!ip_address) {
      return NextResponse.json({ error: 'IP address is required' }, { status: 400 });
    }

    // Send cache clear signal to middleware and check-ip-ban API
    // This will be handled by making internal requests to clear caches
    const clearRequests = [
      // Clear middleware cache
      fetch(new URL('/api/internal/clear-middleware-cache', request.url), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-request': 'true',
        },
        body: JSON.stringify({ ip_address }),
      }),
      // Clear server cache  
      fetch(new URL('/api/internal/clear-server-cache', request.url), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-request': 'true',
        },
        body: JSON.stringify({ ip_address }),
      }),
    ];

    await Promise.all(clearRequests);

    return NextResponse.json({ 
      success: true, 
      message: 'IP cache cleared successfully' 
    });
    
  } catch (error) {
    console.error('Error clearing IP cache:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
