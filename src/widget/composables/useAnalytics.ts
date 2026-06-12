import { ref } from 'vue';
import { apiGet, apiPost } from '../../shared/api';
import type { PageStats } from '../../shared/types';

const VISITOR_KEY = 'guestbook_analytics_visitor_id';
const SESSION_KEY = 'guestbook_analytics_session';
const SESSION_TTL = 30 * 60 * 1000;

/** 内存 fallback：隐私模式或跨域限制下 localStorage/sessionStorage 不可用 */
const memoryVisitorId: { value: string | null } = { value: null };
const memorySessionId: { value: string | null } = { value: null };

function createId(prefix: string): string {
  const random = crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}

function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = createId('v');
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    // 隐私模式或跨域 iframe 限制，使用内存 fallback
    if (!memoryVisitorId.value) {
      memoryVisitorId.value = createId('v');
    }
    return memoryVisitorId.value;
  }
}

function getSessionId(): string {
  const now = Date.now();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw) as { id: string; updatedAt: number };
        if (data.id && now - data.updatedAt < SESSION_TTL) {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: data.id, updatedAt: now }));
          return data.id;
        }
      } catch {}
    }
    const id = createId('s');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, updatedAt: now }));
    return id;
  } catch {
    // 隐私模式或跨域 iframe 限制，使用内存 fallback
    if (!memorySessionId.value) {
      memorySessionId.value = createId('s');
    }
    return memorySessionId.value;
  }
}

function getCanonicalUrl(): string {
  return document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href || window.location.href;
}

function getReferrerDomain(referrer: string): string {
  if (!referrer) return '';
  try {
    return new URL(referrer).hostname;
  } catch {
    return '';
  }
}

function getChannel(referrer: string): string {
  if (!referrer) return 'direct';

  let host = '';
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return 'direct';
  }

  if (host === window.location.hostname.replace(/^www\./, '')) return 'internal';
  if (/(google|bing|baidu|sogou|so\.com|duckduckgo|yahoo|yandex|shenma|sm\.cn)/i.test(host)) return 'search';
  if (/(weibo|zhihu|facebook|twitter|x\.com|t\.co|linkedin|douban|xiaohongshu|xhslink|reddit|pinterest|tumblr|vk\.com|qq\.com|mp\.weixin|digg|mix\.com)/i.test(host)) return 'social';
  return 'referral';
}

function getDeviceType(): string {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function getUtm() {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get('utm_source') || '',
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || '',
  };
}

export function useAnalytics(apiBase: string) {
  const pageStats = ref<PageStats | null>(null);
  const loading = ref(false);

  async function fetchPageStats(pageId: string) {
    const resp = await apiGet<PageStats>(apiBase, `/analytics/page?pageId=${encodeURIComponent(pageId)}`);
    if (resp.success && resp.data) {
      pageStats.value = resp.data;
    }
  }

  async function trackPageView(pageId: string) {
    loading.value = true;
    try {
      const referrer = document.referrer || '';
      const resp = await apiPost<PageStats>(apiBase, '/analytics/view', {
        pageId,
        pageTitle: document.title || '',
        pageUrl: window.location.href,
        canonicalUrl: getCanonicalUrl(),
        referrer,
        referrerDomain: getReferrerDomain(referrer),
        utm: getUtm(),
        channel: getChannel(referrer),
        screen: {
          width: window.screen?.width || 0,
          height: window.screen?.height || 0,
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        deviceType: getDeviceType(),
        language: navigator.language || '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        visitorId: getVisitorId(),
        sessionId: getSessionId(),
      });
      if (resp.success && resp.data) {
        pageStats.value = resp.data;
      }
    } finally {
      loading.value = false;
    }
  }

  return {
    pageStats,
    loading,
    fetchPageStats,
    trackPageView,
  };
}

