// lib/cache-headers.ts — HTTP 缓存头封装

/** 公开资源缓存（仅用于不含用户隐私数据的公开接口） */
export function cacheHeaders(seconds: number): Record<string, string> {
  return {
    'Cache-Control': `public, max-age=${Math.min(seconds, 30)}, stale-while-revalidate=${seconds}`,
    'CDN-Cache-Control': `public, max-age=${seconds}`,
  };
}

/** 私有缓存（仅客户端缓存，CDN 不可缓存，用于含用户数据的接口） */
export function privateCacheHeaders(seconds: number): Record<string, string> {
  return {
    'Cache-Control': `private, max-age=${Math.min(seconds, 30)}, stale-while-revalidate=${seconds}`,
    'CDN-Cache-Control': 'no-store',
  };
}

/** 完全禁止缓存（敏感数据接口） */
export function noCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'CDN-Cache-Control': 'no-store',
  };
}
