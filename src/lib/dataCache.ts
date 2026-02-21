/**
 * Build-time data cache for memoizing API responses
 *
 * This prevents duplicate API calls during the same Astro build.
 * Cache is stored in memory and cleared between builds.
 */

const buildCache = new Map<string, any>();

/**
 * Memoize an async function by caching its result
 *
 * @param key - Unique cache key for this operation
 * @param fn - Async function to memoize
 * @returns Cached result or fresh result from fn
 *
 * @example
 * const activities = await memoize('strava-activities', () => fetchActivities(1, 50));
 */
export async function memoize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (buildCache.has(key)) {
    console.log(`[Cache HIT] ${key}`);
    return Promise.resolve(buildCache.get(key));
  }

  console.log(`[Cache MISS] ${key}`);
  const result = await fn();
  buildCache.set(key, result);
  return result;
}

/**
 * Clear the entire cache (useful for testing)
 */
export function clearCache(): void {
  buildCache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats() {
  return {
    size: buildCache.size,
    keys: Array.from(buildCache.keys())
  };
}
