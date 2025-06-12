// Profile picture cache and request deduplication utility
class ProfilePictureCache {
  private cache = new Map<string, string | null>();
  private pendingRequests = new Map<string, Promise<string | null>>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps = new Map<string, number>();
  private batchQueue = new Set<string>();
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 100; // 100ms delay to collect batch requests
  private readonly BATCH_SIZE = 50; // Maximum batch size

  async getProfilePicture(userId: string): Promise<string | null> {
    // Check if we have a valid cached result
    const cached = this.cache.get(userId);
    const cacheTime = this.cacheTimestamps.get(userId);
    
    if (cached !== undefined && cacheTime && Date.now() - cacheTime < this.CACHE_DURATION) {
      return cached;
    }

    // Check if we already have a pending request for this user
    const pending = this.pendingRequests.get(userId);
    if (pending) {
      return pending;
    }

    // Add to batch queue for efficient batching
    return this.addToBatch(userId);
  }

  private addToBatch(userId: string): Promise<string | null> {
    // Create a promise that will be resolved when the batch is processed
    const promise = new Promise<string | null>((resolve, reject) => {
      this.batchQueue.add(userId);
      
      // Set up batch processing if not already scheduled
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.processBatch().then(() => {
            // Resolve the promise for this user
            const result = this.cache.get(userId) ?? null;
            resolve(result);
          }).catch(reject);
        }, this.BATCH_DELAY);
      } else {
        // If batch is already scheduled, just resolve with cached result when available
        const checkCache = () => {
          const result = this.cache.get(userId);
          if (result !== undefined) {
            resolve(result);
          } else {
            // Check again after a short delay
            setTimeout(checkCache, 10);
          }
        };
        // Give the batch a moment to process
        setTimeout(checkCache, this.BATCH_DELAY + 50);
      }
    });

    // Store the promise after it's been created
    this.pendingRequests.set(userId, promise);
    return promise;
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.size === 0) {
      this.batchTimeout = null;
      return;
    }

    const userIds = Array.from(this.batchQueue);
    this.batchQueue.clear();
    this.batchTimeout = null;

    // Filter out users that are already cached
    const uncachedUserIds = userIds.filter(userId => {
      const cached = this.cache.get(userId);
      const cacheTime = this.cacheTimestamps.get(userId);
      return cached === undefined || !cacheTime || Date.now() - cacheTime >= this.CACHE_DURATION;
    });

    if (uncachedUserIds.length === 0) {
      // All users are already cached, clean up pending requests
      userIds.forEach(userId => this.pendingRequests.delete(userId));
      return;
    }

    try {
      // Use batch endpoint if we have multiple users, otherwise use single endpoint
      if (uncachedUserIds.length > 1) {
        await this.fetchBatchProfilePictures(uncachedUserIds);
      } else {
        const result = await this.fetchSingleProfilePicture(uncachedUserIds[0]);
        this.cache.set(uncachedUserIds[0], result);
        this.cacheTimestamps.set(uncachedUserIds[0], Date.now());
      }
    } catch (error) {
      console.error('Error processing batch profile pictures:', error);
      // Cache null results for failed requests to prevent repeated failures
      uncachedUserIds.forEach(userId => {
        this.cache.set(userId, null);
        this.cacheTimestamps.set(userId, Date.now());
      });
    } finally {
      // Clean up pending requests
      userIds.forEach(userId => this.pendingRequests.delete(userId));
    }
  }

  private async fetchBatchProfilePictures(userIds: string[]): Promise<void> {
    try {
      const response = await fetch('/api/users/profile-pictures-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_ids: userIds }),
      });

      const data = await response.json();

      if (data.success && data.profile_pictures) {
        const now = Date.now();
        for (const [userId, profilePictureUrl] of Object.entries(data.profile_pictures)) {
          this.cache.set(userId, profilePictureUrl as string | null);
          this.cacheTimestamps.set(userId, now);
        }
      } else {
        // Fallback to individual requests if batch fails
        await Promise.all(
          userIds.map(async (userId) => {
            try {
              const result = await this.fetchSingleProfilePicture(userId);
              this.cache.set(userId, result);
              this.cacheTimestamps.set(userId, Date.now());
            } catch (error) {
              console.error(`Fallback fetch failed for user ${userId}:`, error);
              this.cache.set(userId, null);
              this.cacheTimestamps.set(userId, Date.now());
            }
          })
        );
      }
    } catch (error) {
      console.error('Batch profile pictures request failed:', error);
      throw error;
    }
  }

  private async fetchSingleProfilePicture(userId: string): Promise<string | null> {
    try {
      const response = await fetch(`/api/users/profile-picture?user_id=${userId}`);
      const data = await response.json();
      
      if (data.success && data.profile_picture_url) {
        return data.profile_picture_url;
      }
      return null;
    } catch (error) {
      console.error('Error fetching profile picture:', error);
      return null;
    }
  }

  // Method to invalidate cache for a specific user (useful when profile is updated)
  invalidateUser(userId: string): void {
    this.cache.delete(userId);
    this.cacheTimestamps.delete(userId);
    this.pendingRequests.delete(userId);
  }

  // Method to clear old cache entries
  cleanup(): void {
    const now = Date.now();
    for (const [userId, timestamp] of this.cacheTimestamps.entries()) {
      if (now - timestamp > this.CACHE_DURATION) {
        this.cache.delete(userId);
        this.cacheTimestamps.delete(userId);
      }
    }
  }

  // Method to prefetch multiple profile pictures efficiently
  async prefetchMultiple(userIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(userIds)];
    const uncachedIds = uniqueIds.filter(userId => {
      const cached = this.cache.get(userId);
      const cacheTime = this.cacheTimestamps.get(userId);
      return cached === undefined || !cacheTime || Date.now() - cacheTime >= this.CACHE_DURATION;
    });

    if (uncachedIds.length === 0) {
      return;
    }

    try {
      if (uncachedIds.length > 1) {
        await this.fetchBatchProfilePictures(uncachedIds);
      } else {
        const result = await this.fetchSingleProfilePicture(uncachedIds[0]);
        this.cache.set(uncachedIds[0], result);
        this.cacheTimestamps.set(uncachedIds[0], Date.now());
      }
    } catch (error) {
      console.warn('Error prefetching profile pictures:', error);
    }
  }
}

// Create a singleton instance
export const profilePictureCache = new ProfilePictureCache();

// Cleanup old entries every 10 minutes
setInterval(() => {
  profilePictureCache.cleanup();
}, 10 * 60 * 1000);
