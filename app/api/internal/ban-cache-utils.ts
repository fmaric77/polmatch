// Utility functions for managing ban cache
export interface BanCacheEntry {
  banned: boolean;
  ban_date: string | null;
  timestamp: number;
}

export const serverBanCache = new Map<string, BanCacheEntry>();
export const SERVER_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes in milliseconds

export function isServerCacheValid(entry: BanCacheEntry): boolean {
  return (Date.now() - entry.timestamp) < SERVER_CACHE_DURATION;
}

// Clean up expired cache entries
export function cleanupServerCache(): void {
  for (const [ip, entry] of serverBanCache.entries()) {
    if (!isServerCacheValid(entry)) {
      serverBanCache.delete(ip);
    }
  }
}

// Function to clear cache for specific IP (for immediate invalidation)
export function clearServerCache(ip_address: string): void {
  serverBanCache.delete(ip_address);
  console.log(`Cleared server cache for IP: ${ip_address}`);
}

// Run cache cleanup every 5 minutes
if (typeof globalThis !== 'undefined') {
  setInterval(cleanupServerCache, 5 * 60 * 1000);
}
