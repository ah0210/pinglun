(function () {
  /**
   * 支持三种选择器：
   * 1. [data-guestbook-count][data-page-id] — 列表页留言数（guestbook-count.html）
   * 2. .guestbook-comment-count[data-path]  — FixIt 主题文章元信息区评论数
   * 3. [data-guestbook-views][data-page-id]  — 列表页浏览量（guestbook-views.html）
   */
  var selectorCount1 = '[data-guestbook-count][data-page-id]';
  var selectorCount2 = '.guestbook-comment-count[data-path]';
  var selectorViews = '[data-guestbook-views][data-page-id]';

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

  /** 格式化留言数文本 */
  function formatCountText(el, count) {
    var format = el.getAttribute('data-format') || '{count}';
    return format.replace(/\{count\}/g, String(count));
  }

  /** 格式化浏览量文本 */
  function formatViewsText(el, views, visitors) {
    var format = el.getAttribute('data-format') || '{views}';
    return format
      .replace(/\{views\}/g, String(views))
      .replace(/\{visitors\}/g, String(visitors));
  }

  /** 收集所有计数元素的 pageId → 元素映射 */
  function collectNodes() {
    var map = {};
    document.querySelectorAll(selectorCount1).forEach(function (el) {
      var pageId = (el.getAttribute('data-page-id') || '').trim();
      if (pageId && !map[pageId]) map[pageId] = { count: [], views: [] };
      if (pageId) map[pageId].count.push({ el: el, attr: 'data-page-id' });
    });
    document.querySelectorAll(selectorCount2).forEach(function (el) {
      var path = (el.getAttribute('data-path') || '').trim();
      if (path && !map[path]) map[path] = { count: [], views: [] };
      if (path) map[path].count.push({ el: el, attr: 'data-path' });
    });
    document.querySelectorAll(selectorViews).forEach(function (el) {
      var pageId = (el.getAttribute('data-page-id') || '').trim();
      if (pageId && !map[pageId]) map[pageId] = { count: [], views: [] };
      if (pageId) map[pageId].views.push(el);
    });
    return map;
  }

  /** 将 API 返回的数据填充到所有计数/浏览量元素 */
  function applyData(counts, views) {
    var map = collectNodes();
    Object.keys(map).forEach(function (pageId) {
      var count = (counts && counts[pageId]) || 0;
      var viewData = (views && views[pageId]) || { views: 0, visitors: 0 };

      // 填充留言数
      map[pageId].count.forEach(function (item) {
        if (item.attr === 'data-page-id') {
          item.el.textContent = formatCountText(item.el, count);
          item.el.setAttribute('data-count', String(count));
        } else {
          item.el.textContent = String(count);
        }
      });

      // 填充浏览量
      map[pageId].views.forEach(function (el) {
        el.textContent = formatViewsText(el, viewData.views, viewData.visitors);
        el.setAttribute('data-views', String(viewData.views));
        el.setAttribute('data-visitors', String(viewData.visitors));
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
        if (json && json.success && json.data) {
          // 兼容旧 API（仅返回 counts）和新 API（返回 { counts, views }）
          var counts = json.data.counts !== undefined ? json.data.counts : json.data;
          var views = json.data.views || {};
          applyData(counts, views);
        }
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
   * 监听框架级页面切换事件，翻页后重新扫描并填充新出现的计数元素
   * - pjax: document 触发 pjax:complete 事件
   * - swup: document 触发 swup:contentReplaced 事件
   * - Turbo (Hotwire): document 触发 turbo:render 事件
   * - Barba.js: document 触发 barba:after 事件
   */
  var debounceTimer = null;
  function debouncedLoadCounts() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadCounts, 100);
  }
  document.addEventListener('pjax:complete', debouncedLoadCounts);
  document.addEventListener('swup:contentReplaced', debouncedLoadCounts);
  document.addEventListener('turbo:render', debouncedLoadCounts);
  document.addEventListener('barba:after', debouncedLoadCounts);

  /**
   * MutationObserver 通用兜底：监听 DOM 中新增的计数/浏览量元素
   * 适用于任何分页方式（AJAX 翻页、无限滚动、动态加载等）
   * 仅在新增目标元素时触发，避免无关 DOM 变动引起频繁请求
   */
  var observedCount = 0;
  var observer = new MutationObserver(function (mutations) {
    var hasNewTarget = false;
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        if (node.matches && (
          node.matches(selectorCount1) || node.matches(selectorCount2) || node.matches(selectorViews)
        )) {
          hasNewTarget = true;
          break;
        }
        if (node.querySelector && (
          node.querySelector(selectorCount1) || node.querySelector(selectorCount2) || node.querySelector(selectorViews)
        )) {
          hasNewTarget = true;
          break;
        }
      }
      if (hasNewTarget) break;
    }
    if (hasNewTarget) debouncedLoadCounts();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
