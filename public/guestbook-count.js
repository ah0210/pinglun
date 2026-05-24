(function () {
  /**
   * 支持两种选择器：
   * 1. [data-guestbook-count][data-page-id] — 列表页专用（guestbook-count.html）
   * 2. .guestbook-comment-count[data-path]  — FixIt 主题文章元信息区（内容页+列表页通用）
   */
  var selector1 = '[data-guestbook-count][data-page-id]';
  var selector2 = '.guestbook-comment-count[data-path]';

  function inferApiBase() {
    if (window.GUESTBOOK_API_BASE) {
      var configured = String(window.GUESTBOOK_API_BASE).replace(/\/+$/, '');
      return /\/api\/v1$/.test(configured) ? configured : configured + '/api/v1';
    }
    var script = document.currentScript || document.querySelector('script[src*="guestbook-count.js"]');
    if (script && script.src) {
      try {
        var url = new URL(script.src, window.location.href);
        return url.origin + '/api/v1';
      } catch (_) {}
    }
    return '/api/v1';
  }

  function formatText(el, count) {
    var format = el.getAttribute('data-format') || '{count}';
    return format.replace(/\{count\}/g, String(count));
  }

  /** 收集所有计数元素的 pageId → 元素映射 */
  function collectNodes() {
    var map = {};
    document.querySelectorAll(selector1).forEach(function (el) {
      var pageId = (el.getAttribute('data-page-id') || '').trim();
      if (pageId && !map[pageId]) map[pageId] = [];
      if (pageId) map[pageId].push({ el: el, attr: 'data-page-id' });
    });
    document.querySelectorAll(selector2).forEach(function (el) {
      var path = (el.getAttribute('data-path') || '').trim();
      if (path && !map[path]) map[path] = [];
      if (path) map[path].push({ el: el, attr: 'data-path' });
    });
    return map;
  }

  /** 将 API 返回的 counts 填充到所有计数元素 */
  function applyCounts(counts) {
    var map = collectNodes();
    Object.keys(map).forEach(function (pageId) {
      var count = counts[pageId] || 0;
      map[pageId].forEach(function (item) {
        if (item.attr === 'data-page-id') {
          item.el.textContent = formatText(item.el, count);
          item.el.setAttribute('data-count', String(count));
        } else {
          item.el.textContent = String(count);
        }
      });
    });
  }

  function loadCounts() {
    var map = collectNodes();
    var pageIds = Object.keys(map);
    if (!pageIds.length) return;

    var params = new URLSearchParams();
    pageIds.forEach(function (pageId) {
      params.append('pageId', pageId);
    });

    fetch(inferApiBase() + '/messages/counts?' + params.toString(), {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    })
      .then(function (resp) { return resp.ok ? resp.json() : null; })
      .then(function (json) {
        if (json && json.success && json.data) applyCounts(json.data);
      })
      .catch(function () {});
  }

  window.GuestbookCounts = {
    refresh: loadCounts,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCounts);
  } else {
    loadCounts();
  }

  /**
   * 监听 pjax/swup 页面切换事件，翻页后重新扫描并填充新出现的计数元素
   * - pjax: document 触发 pjax:complete 事件
   * - swup: document 触发 swup:contentReplaced 事件
   */
  var debounceTimer = null;
  function debouncedLoadCounts() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadCounts, 100);
  }
  document.addEventListener('pjax:complete', debouncedLoadCounts);
  document.addEventListener('swup:contentReplaced', debouncedLoadCounts);
})();
