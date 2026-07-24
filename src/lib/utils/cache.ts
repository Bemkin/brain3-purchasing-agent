/**
 * Stale-While-Revalidate In-Memory Client Cache Utility
 * Provides 0ms instant UI page switching by caching API responses for 30 seconds.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cacheMap = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 30_000; // 30 seconds default TTL

/**
 * Fetch with client-side in-memory cache.
 * If valid cache entry exists, returns cached data immediately without hitting the network or DB.
 */
export async function fetchWithCache<T>(url: string, forceFresh = false, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const cached = cacheMap.get(url);
  const now = Date.now();

  if (!forceFresh && cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed for ${url}: ${res.statusText}`);
  }

  const data = (await res.json()) as T;
  cacheMap.set(url, { data, timestamp: now });
  return data;
}

/**
 * Invalidate client cache entries (e.g. after stock audits, PO status changes, or simulations)
 */
export function invalidateCache(urlPrefix?: string): void {
  if (!urlPrefix) {
    cacheMap.clear();
    return;
  }
  for (const key of cacheMap.keys()) {
    if (key.startsWith(urlPrefix)) {
      cacheMap.delete(key);
    }
  }
}
