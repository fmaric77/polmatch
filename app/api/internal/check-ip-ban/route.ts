import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = 'mongodb+srv://filip:ezxMAOvcCtHk1Zsk@cluster0.9wkt8p3.mongodb.net/';

// In-memory cache for the API as well (server-side)
interface BanCacheEntry {
  banned: boolean;
  ban_date: string | null;
  timestamp: number;
}

const serverBanCache = new Map<string, BanCacheEntry>();
const SERVER_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes in milliseconds

function isServerCacheValid(entry: BanCacheEntry): boolean {
  return (Date.now() - entry.timestamp) < SERVER_CACHE_DURATION;
}

// Clean up expired cache entries
function cleanupServerCache(): void {
  const now = Date.now();
  for (const [ip, entry] of serverBanCache.entries()) {
    if (!isServerCacheValid(entry)) {
      serverBanCache.delete(ip);
    }
  }
}

// Run cache cleanup every 5 minutes
if (typeof globalThis !== 'undefined') {
  setInterval(cleanupServerCache, 5 * 60 * 1000);
}

// Function to clear cache for specific IP (for immediate invalidation)
export function clearServerCache(ip_address: string): void {
  serverBanCache.delete(ip_address);
  console.log(`Cleared server cache for IP: ${ip_address}`);
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
    const client = new MongoClient(MONGODB_URI);
    
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
