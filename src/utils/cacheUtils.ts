interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number; // Time in milliseconds when cache expires
}

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes default

export class LocalStorageCache {
  private static instance: LocalStorageCache;
  
  static getInstance(): LocalStorageCache {
    if (!LocalStorageCache.instance) {
      LocalStorageCache.instance = new LocalStorageCache();
    }
    return LocalStorageCache.instance;
  }

  private constructor() {}

  /**
   * Set data in cache with TTL
   */
  set<T>(key: string, data: T, config: CacheConfig = { ttl: DEFAULT_TTL }): void {
    try {
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + config.ttl
      };
      
      localStorage.setItem(key, JSON.stringify(cacheItem));
      console.log(`💾 Cached data for key: ${key} (TTL: ${config.ttl}ms)`);
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }

  /**
   * Get data from cache if not expired
   */
  get<T>(key: string): T | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) {
        console.log(`🔍 Cache miss for key: ${key}`);
        return null;
      }

      const cacheItem: CacheItem<T> = JSON.parse(cached);
      
      // Check if cache has expired
      if (Date.now() > cacheItem.expiry) {
        console.log(`⏰ Cache expired for key: ${key}`);
        this.remove(key);
        return null;
      }

      console.log(`✅ Cache hit for key: ${key}`);
      
      // Handle special cases for data that needs date conversion
      const data = this.deserializeDates(cacheItem.data, key);
      return data;
    } catch (error) {
      console.warn('Failed to get cached data:', error);
      this.remove(key);
      return null;
    }
  }

  /**
   * Convert date strings back to Date objects for specific data types
   */
  private deserializeDates<T>(data: T, key: string): T {
    // Handle CalendarEvent arrays (events cache)
    if (key.includes('eventhorizon_events_') && Array.isArray(data)) {
      return (data as any[]).map(event => ({
        ...event,
        startTime: new Date(event.startTime)
      })) as T;
    }
    
    // Handle BookmarkEvent arrays (bookmarks cache)
    if (key === 'eventhorizon_bookmarks' && Array.isArray(data)) {
      return (data as any[]).map(bookmark => ({
        ...bookmark,
        // Convert time field if it's a date string
        time: bookmark.time && bookmark.time.includes('T') ? bookmark.time : bookmark.time
      })) as T;
    }
    
    return data;
  }

  /**
   * Remove data from cache
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
      console.log(`🗑️ Removed cache for key: ${key}`);
    } catch (error) {
      console.warn('Failed to remove cached data:', error);
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    try {
      // Only clear our app's cache keys (those starting with 'eventhorizon_')
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('eventhorizon_')) {
          localStorage.removeItem(key);
        }
      });
      console.log('🧹 Cleared all app cache');
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Check if cache exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Get cache info (for debugging)
   */
  getInfo(key: string): { exists: boolean; expired?: boolean; age?: number } {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) {
        return { exists: false };
      }

      const cacheItem: CacheItem<any> = JSON.parse(cached);
      const now = Date.now();
      const expired = now > cacheItem.expiry;
      const age = now - cacheItem.timestamp;

      return {
        exists: true,
        expired,
        age
      };
    } catch (error) {
      return { exists: false };
    }
  }

  /**
   * Debug method to check cache contents
   */
  debug(key?: string): void {
    if (key) {
      const info = this.getInfo(key);
      const data = this.get(key);
      console.log(`🔍 Cache debug for ${key}:`, { info, data });
    } else {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('eventhorizon_'));
      console.log('🔍 All cache keys:', keys);
      keys.forEach(k => {
        const info = this.getInfo(k);
        console.log(`  ${k}:`, info);
      });
    }
  }
}

// Cache keys for different data types
export const CACHE_KEYS = {
  CALENDAR_EVENTS: (timeFilter: string, specificDate?: string) => 
    `eventhorizon_events_${timeFilter}${specificDate ? `_${specificDate}` : ''}`,
  BOOKMARKS: 'eventhorizon_bookmarks',
  TODOS: (params?: string) => `eventhorizon_todos${params ? `_${params}` : ''}`,
  HORIZONS: 'eventhorizon_horizons',
  BOOKMARK_TITLES: 'eventhorizon_bookmark_titles'
} as const;

// Cache TTL configurations (in milliseconds)
export const CACHE_TTL = {
  EVENTS: 2 * 60 * 1000,      // 2 minutes - events change frequently
  BOOKMARKS: 5 * 60 * 1000,   // 5 minutes - bookmarks change less frequently  
  TODOS: 3 * 60 * 1000,       // 3 minutes - todos change moderately
  HORIZONS: 10 * 60 * 1000,   // 10 minutes - horizons change infrequently
} as const;

// Export singleton instance
export const cache = LocalStorageCache.getInstance();
