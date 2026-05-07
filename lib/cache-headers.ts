// lib/cache-headers.ts — HTTP 缓存头封装

export function cacheHeaders(seconds: number): Record<string, string> {
  return {
    'Cache-Control': `public, max-age=${Math.min(seconds, 30)}, stale-while-revalidate=${seconds}`,
    'CDN-Cache-Control': `public, max-age=${seconds}`,
  };
}

export function noCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'CDN-Cache-Control': 'no-store',
  };
}
