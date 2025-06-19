import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { 
  serverBanCache, 
  isServerCacheValid
} from '../ban-cache-utils';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify this is an internal request
    const internalHeader = request.headers.get('x-internal-request');
    if (internalHeader !== 'true') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ip_address } = await request.json();
    
    if (!ip_address || ip_address === 'unknown') {
      return NextResponse.json({ banned: false });
    }

    // Check server-side cache first
    const cachedEntry = serverBanCache.get(ip_address);
    if (cachedEntry && isServerCacheValid(cachedEntry)) {
      return NextResponse.json({ 
        banned: cachedEntry.banned,
        ban_date: cachedEntry.ban_date 
      });
    }

    // Connect to MongoDB and check ban status
    const client = new MongoClient(MONGODB_URI as string);
    
    try {
      await client.connect();
      const db = client.db('polmatch');
      
      // Check if IP exists in ban collection
      const ban = await db.collection('ban').findOne({ ip_address });
      
      const result = {
        banned: ban !== null,
        ban_date: ban?.ban_date || null
      };

      // Cache the result
      serverBanCache.set(ip_address, {
        ...result,
        timestamp: Date.now()
      });
      
      if (ban !== null) {
        // If IP is banned, also clear any existing sessions from this IP
        const sessionDeleteResult = await db.collection('sessions').deleteMany({
          ip_address: ip_address
        });
        
        if (sessionDeleteResult.deletedCount > 0) {
          console.log(`Cleared ${sessionDeleteResult.deletedCount} active sessions from banned IP: ${ip_address}`);
        }
      }
      
      return NextResponse.json(result);
      
    } finally {
      await client.close();
    }
    
  } catch (error) {
    console.error('Error checking IP ban status:', error);
    return NextResponse.json({ banned: false }, { status: 500 });
  }
}
