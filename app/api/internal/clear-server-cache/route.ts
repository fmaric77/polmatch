import { NextRequest, NextResponse } from 'next/server';
import { clearServerCache } from '../ban-cache-utils';

// Clear server cache endpoint  
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

    // Clear the server cache for the specified IP
    clearServerCache(ip_address);

    return NextResponse.json({ 
      success: true, 
      message: 'Server cache cleared for IP' 
    });
    
  } catch (error) {
    console.error('Error clearing server cache:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
