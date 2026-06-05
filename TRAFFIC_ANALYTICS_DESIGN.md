# 流量统计功能技术方案

## 目标

为当前留言板 / 嵌入式 widget 增加流量统计能力：

- 记录每个页面的浏览事件。
- 统计每个页面的浏览量、访客数、会话数。
- 采集来源、渠道、国家、设备、屏幕、语言、时区等分析维度。
- 在宿主页面展示当前页面的浏览量。
- 尽量降低隐私风险和 D1 查询成本。

第一版建议做“性能优先、查询快速、后台可直接指导 SEO 动作”的访问统计，不做繁琐图表和复杂脱敏逻辑。

## 推荐范围

第一版实现：

- 前台 widget 自动上报访问事件。
- 宿主页面默认显示当前页面 PV。
- 数据库保存真实 IP / visitor / session，不做脱敏和 hash。
- 采集文章标题、页面链接和 canonical 链接，方便后台直接打开验证。
- 采集粗粒度设备和来源信息。
- 原始事件保留 90 天，聚合数据长期保留。
- 后台统计第一版需要能快速判断站点流量、内容表现和 SEO 效果。
- 页面统计表同时保存 PV、UV、session 和留言数，前台文章页展示浏览量和留言数时直接查询该表。

## 浏览量展示决策

宿主页面第一版只展示 PV：

```text
浏览 123
```

后端同时计算：

- `views`: PV，总浏览次数。
- `visitors`: UV，去重访客数。
- `sessions`: 会话数。

前台默认只显示 `views`，以后可扩展配置：

```html
<guestbook-widget show-view-count="true"></guestbook-widget>
```

未来可选：

```html
view-count-mode="views"
view-count-mode="visitors"
view-count-mode="both"
```

第一版建议只开放 `show-view-count`，内部 API 保留 PV / UV / session。

`show-view-count` 的作用：

- 控制 widget 是否在宿主页面显示当前文章的浏览量。
- 只影响前台展示，不控制访问事件采集。
- 当 `show-view-count="true"` 时，widget 调用 `GET /api/v1/analytics/page?pageId=xxx`，展示 `views`。
- 当 `show-view-count="false"` 时，widget 不展示浏览量，但如果后台统计总开关开启，仍然会上报访问事件。
- 留言数也从同一个页面统计接口返回，后续宿主页面需要展示“浏览量 + 留言数”时无需额外查 `messages` 表。

是否采集流量由后台配置开关控制，建议命名为 `analytics_enabled`。

建议配置关系：

```text
analytics_enabled = 是否采集和写入统计数据
show_view_count = 是否在前台显示浏览量
```

默认建议：

```text
analytics_enabled = true
show_view_count = true
```

## 数据采集决策

本项目确认性能优先、实现简洁优先：

- 保存真实 `ip_address / visitor_id / session_id`。
- 不做脱敏展示。
- 不保存 hash 字段。
- 不设计复杂权限下的敏感字段隐藏。
- 不采集浏览器指纹、鼠标轨迹、滚动深度等复杂行为数据。
- 不把 IP / visitor / session 写入 console 日志。

服务端通过 Cloudflare 获取：

- `CF-Connecting-IP`
- `CF-IPCountry`

入库字段：

```text
ip_address = CF-Connecting-IP
visitor_id = 客户端长期访客 ID
session_id = 客户端会话 ID
country = CF-IPCountry
```

管理员统计接口必须鉴权，不提供公开原始事件查询。README 或部署说明中应明确写出采集项。

不建议第一版采集或长期保存：

- User-Agent 原文
- 鼠标轨迹
- 滚动深度
- 点击热区
- canvas / audio / font 指纹
- 浏览器插件或字体列表

由于保存了真实 IP / visitor / session，原始事件保留周期不建议无限延长。第一版建议保留 90 天，最多 180 天。聚合统计和页面统计表长期保留。

## 数据保留策略

建议：

- 原始访问事件保留 90 天。
- 日聚合数据长期保留。
- 页面累计总量长期保留。

清理逻辑可放入现有 `scheduled.ts`：

```sql
DELETE FROM analytics_events
WHERE created_at < datetime('now', '-90 days');
```

选择 90 天的原因：

- 30 天对趋势分析偏短。
- 180 天会让 D1 原始事件表膨胀更快。
- 90 天足够查看近期来源、渠道、页面表现。
- 长期价值由聚合表承载。

## 原始事件表与每日聚合表

### 原始事件表

`analytics_events` 是明细流水表，每一次页面访问都会写入一行。

它回答的问题是：

```text
谁在什么时候，以什么来源和设备，打开了哪个页面？
```

作用：

- 近期访问明细分析。
- 来源、国家、设备、渠道分析。
- 防刷和异常流量排查。
- 后续重新计算统计口径。
- 支撑后台更细粒度的 SEO 分析。

原始事件表增长最快，因此需要定期清理。清理的是明细，不是统计结果。

### 每日聚合表

`analytics_page_daily` 是按页面、按天汇总后的结果表。

它保存类似：

```text
date = 2026-05-26
page_id = /post/a
views = 123
visitors = 45
sessions = 61
```

作用：

- 查询快。
- D1 成本低。
- 后台趋势图无需扫描大量原始事件。
- 原始事件清理后，历史趋势仍然保留。
- 支持长期分析页面增长趋势、SEO 效果和内容表现。

建议保留策略：

- 原始事件：保留 90 天，用于近期细节分析。
- 每日聚合：长期保留，用于历史趋势。
- 页面总量：长期保留，用于页面展示。

## 后台建设策略

第一版后台应能快速回答站点流量和 SEO 内容优化问题，而不是只展示总 PV。

第一阶段建议包含：

- 数据表。
- 访问上报 API。
- 当前页面统计查询 API。
- 宿主页面 PV 展示。
- 管理后台流量概览页。
- 页面表现列表。
- 来源 / 渠道 / 搜索入口分析。

第二阶段可增强图表、筛选和导出。

## 后台流量分析设计

后台流量分析应围绕“当前流量怎么样、哪些内容有效、SEO 怎么改进”三类问题设计。

第一版不做繁琐图表，核心采用：

- 汇总数字。
- 可排序表格。
- 状态标签。
- 建议动作。
- 一键打开原文。

后台的目标不是做数据大屏，而是让管理员快速判断哪些文章应该更新、扩写、加内链或调整标题。

### 概览面板

建议展示：

- 今日 PV / UV / sessions。
- 昨日 PV / UV / sessions。
- 最近 7 天、30 天 PV 趋势。
- 今日较昨日增长率。
- 最近 7 天较前 7 天增长率。
- 当前热门页面 Top 10。
- 搜索流量占比。
- 直接访问、站内访问、搜索、社交、外链来源占比。

概览页目标是 10 秒内判断：

- 流量是否上涨或下跌。
- 下跌发生在哪些页面或渠道。
- 当前是否有异常刷量。
- 哪些内容正在获得自然搜索流量。

### 内容 SEO 评估表

这是后台流量分析的核心页面。

每行是一篇文章或一个内容页面。建议字段：

- 页面标题或 `page_id`。
- `page_url`。
- 打开原文按钮。
- canonical 链接。
- PV。
- UV。
- sessions。
- 留言数。
- 搜索流量 PV。
- 搜索流量占比。
- 外链来源数。
- 平均每日 PV。
- 最近 7 天趋势。
- 最后访问时间。

建议支持排序：

- PV 最高。
- 搜索流量最高。
- 搜索占比最高。
- 最近增长最快。
- 最近衰退最快。
- 有访问但无留言。
- 有留言但搜索流量弱。
- PV 高但留言少。
- 搜索占比高但 PV 低。
- 长期无访问。
- 最近突然增长。

建议每行后端直接返回 SEO 标签：

- `增长中`: 最近 7 天 PV 比前 7 天增长超过 50%。
- `衰退中`: 最近 7 天 PV 比前 7 天下降超过 30%。
- `搜索入口`: 搜索来源 PV 占比超过 40%。
- `长尾机会`: 搜索占比高但总 PV 不高。
- `高互动`: 留言数 / PV 高。
- `低互动高流量`: PV 高但留言少。
- `需更新`: 历史 PV 高，但最近 30 天明显下降。
- `内链不足`: PV 高但站内来源低。
- `标题待优化`: 有访问但搜索占比低、外链少、留言少。

SEO 上的用法：

- `搜索流量高 + 留言多`：说明内容命中需求，优先维护和内链推荐。
- `PV 高 + 搜索占比低`：可能依赖站内或社交流量，可优化标题、描述、关键词。
- `搜索占比高 + PV 低`：可能是长尾词入口，适合扩写内容或做相关文章集群。
- `历史 PV 高但最近下降`：检查内容是否过期、标题是否不匹配、是否需要更新。
- `PV 高 + 留言少`：检查页面结尾引导、问题设置和评论入口是否明显。

后端建议直接返回建议动作，例如：

```json
{
  "pageId": "/post/a",
  "pageTitle": "文章标题",
  "pageUrl": "https://example.com/post/a",
  "canonicalUrl": "https://example.com/post/a",
  "views7d": 120,
  "views30d": 500,
  "searchViews30d": 300,
  "searchShare": 0.6,
  "growth7d": 0.8,
  "messageCount": 12,
  "labels": ["搜索入口", "增长中"],
  "recommendation": "补充内容并增加相关文章内链"
}
```

### 内容 SEO 评估表第一版确认建议

第一版不做复杂图表，优先做一个可排序、可筛选、可直接行动的表格。

固定列：

- 标题。
- 打开原文。
- canonical 链接。
- 7 天 PV。
- 30 天 PV。
- 7 天搜索 PV。
- 30 天搜索 PV。
- 搜索占比。
- 7 天增长率。
- 30 天增长率。
- 留言数。
- 留言率。
- 来源域名数。
- 最后访问时间。
- SEO 标签。
- 建议动作。

第一版排序：

- 30 天 PV 最高。
- 7 天 PV 最高。
- 搜索 PV 最高。
- 搜索占比最高。
- 最近 7 天增长最快。
- 最近 7 天下降最快。
- 留言数最高。
- 留言率最高。
- 长期无访问。
- 最近新增访问。

第一版筛选：

- 全部页面。
- 搜索入口页面。
- 增长页面。
- 衰退页面。
- 长尾机会。
- 高互动页面。
- 低互动高流量页面。
- 需更新页面。
- 无留言页面。

第一版 SEO 标签规则：

- `搜索入口`: 30 天搜索 PV >= 10 且搜索占比 >= 40%。
- `增长中`: 最近 7 天 PV 比前 7 天增长 >= 50%，且最近 7 天 PV >= 10。
- `衰退中`: 最近 7 天 PV 比前 7 天下降 >= 30%，且前 7 天 PV >= 10。
- `长尾机会`: 搜索占比 >= 60%，但 30 天 PV < 100。
- `高互动`: 留言率 >= 5%，且 30 天 PV >= 20。
- `低互动高流量`: 30 天 PV >= 200，留言数 = 0 或留言率 < 1%。
- `需更新`: 历史累计 PV 较高，但最近 30 天 PV 明显低于前 30 天。
- `内链不足`: 30 天 PV >= 100，internal_views 占比 < 10%。
- `标题待优化`: 有稳定 PV，但搜索占比低、来源域名少、留言少。

第一版建议动作：

- `补充内容`: 用于增长中、搜索入口、长尾机会页面。
- `更新旧内容`: 用于衰退中、需更新页面。
- `增加相关文章内链`: 用于搜索入口、长尾机会、内链不足页面。
- `优化标题和摘要`: 用于标题待优化页面。
- `强化留言引导`: 用于低互动高流量页面。
- `沉淀 FAQ 或评论精选`: 用于高互动页面。
- `检查来源异常`: 用于短时间异常增长页面。

表格默认排序建议：

```text
优先显示：衰退中、搜索入口、增长中、长尾机会、低互动高流量
默认排序：30 天搜索 PV DESC，其次 7 天增长率 DESC
```

这样后台打开后，最先看到的是对 SEO 最有行动价值的内容，而不是单纯 PV 最高的页面。

### 来源与渠道分析

渠道建议分为：

- `search`: 搜索引擎。
- `direct`: 直接访问。
- `internal`: 站内来源。
- `social`: 社交平台。
- `referral`: 普通外链。
- `paid`: 付费推广。
- `email`: 邮件。
- `campaign`: 其他 UTM 活动。

后台建议展示：

- 各渠道 PV / UV / sessions。
- 各渠道占比。
- 渠道趋势。
- Top referrer domain。
- 每个来源域名带来的 Top 页面。

SEO 上的用法：

- 搜索流量增长：说明自然搜索收录和排名可能改善。
- referral 来源增长：说明内容被外站引用，可考虑加强相关主题。
- internal 占比高但 search 低：说明站内导航有效，但外部发现能力不足。
- direct 高：可能是品牌访问、收藏访问，也可能是 referrer 丢失。

### 搜索入口分析

由于浏览器不会稳定提供搜索关键词，第一版不能可靠获得用户搜索词。可以通过搜索引擎 referrer 判断搜索来源，例如：

- Google
- Bing
- Baidu
- Sogou
- 360 Search

后台建议展示：

- 搜索引擎来源分布。
- 搜索流量 Top 页面。
- 搜索入口页面最近 7 / 30 天趋势。
- 新增搜索入口页面。
- 搜索流量下降页面。

SEO 上的用法：

- 找出自然搜索带来访问的页面。
- 优先更新搜索流量正在下降的页面。
- 对搜索入口页面增加相关文章内链，提升站内分发。
- 对搜索流量高的主题扩展专题页或系列文章。

### 内容机会分析

建议后台增加“内容机会”视图。

可先用简单规则生成：

- `增长页面`: 最近 7 天 PV 高于前 7 天 50%。
- `衰退页面`: 最近 7 天 PV 低于前 7 天 30%。
- `长尾页面`: 搜索占比高但总 PV 不高。
- `高互动页面`: 留言数 / PV 高。
- `低互动高流量页面`: PV 高但留言少。
- `待更新页面`: 曾经高流量，最近 30 天明显下降。

SEO 上的动作建议：

- 增长页面：补充内容、加内链、增加相关留言引导。
- 衰退页面：更新标题、摘要、正文时效信息。
- 长尾页面：围绕同主题扩展更多内容。
- 高互动页面：沉淀 FAQ 或评论精选。
- 低互动高流量页面：优化页面结尾引导。

### 地域与设备分析

建议展示：

- 国家 / 地区分布。
- 移动端、平板、桌面占比。
- 不同设备的 Top 页面。
- 不同国家的 Top 页面。

SEO 和内容优化用途：

- 移动端占比高：优先检查移动端首屏、加载速度、按钮和留言体验。
- 特定国家流量高：考虑内容语言、时间表达、外链渠道。
- 桌面端高：可能适合长文、教程、资料型内容。

### 异常流量分析

保存真实 IP 后，后台可以提供基础异常分析：

- 同 IP 短时间大量访问。
- 同 visitor 频繁刷新。
- 单页面短时间 PV 激增。
- 异常国家或来源突然增加。
- 无 referrer 且高频访问。

这些数据用于识别刷量、爬虫、攻击或异常传播。

后台展示时建议：

- 直接展示完整 IP。
- 支持按 IP / visitor / session 查看近期访问轨迹。

## SEO 指标口径

建议第一版使用这些指标：

- `Search PV`: 来自搜索引擎的 PV。
- `Search Share`: 搜索 PV / 总 PV。
- `Page Growth 7d`: 最近 7 天 PV 与前 7 天对比。
- `Page Growth 30d`: 最近 30 天 PV 与前 30 天对比。
- `Engagement Proxy`: 留言数 / PV。
- `Referrer Domains`: 给页面带来访问的来源域名数量。
- `Freshness Candidate`: 历史高流量但近期下降的页面。

这些指标不需要搜索关键词，也能帮助判断内容的 SEO 表现。

## 采集字段

服务端生成或读取：

- `id`
- `page_id`
- `page_title`
- `page_url`
- `canonical_url`
- `ip_address`
- `country`
- `created_at`

客户端上报：

- `referrer`
- `referrer_domain`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `channel`
- `device_type`
- `screen_width`
- `screen_height`
- `viewport_width`
- `viewport_height`
- `language`
- `timezone`
- `visitor_id`
- `session_id`

屏幕和设备建议使用粗粒度：

- `device_type`: `mobile` / `tablet` / `desktop`
- 宽高可以保留整数，但分析时优先按区间聚合。

## 渠道归因规则

渠道优先级：

1. 有 `utm_medium` 时，优先使用 UTM：
   - `cpc` / `paid` / `ads` => `paid`
   - `email` => `email`
   - `social` => `social`
   - 其他值保留或归入 `campaign`
2. 没有 UTM 时，根据 `referrer_domain` 判断：
   - 空 referrer => `direct`
   - 自己域名 => `internal`
   - 搜索引擎 => `search`
   - 社交平台 => `social`
   - 其他 => `referral`

第一版可在客户端计算 `channel`，后端做兜底校正。

## 数据库设计

建议新增五张表。设计原则是写入简单、查询快速，后台 SEO 评估尽量不扫描原始事件表。

### analytics_events

原始事件表。

```text
id
page_id
page_title
page_url
canonical_url
referrer
referrer_domain
utm_source
utm_medium
utm_campaign
channel
country
device_type
screen_width
screen_height
viewport_width
viewport_height
language
timezone
ip_address
visitor_id
session_id
created_at
```

用途：

- 保存近期访问明细。
- 支持异常访问排查。
- 支持后续重新计算聚合口径。

性能原则：

- 只追加写入。
- 少建索引，避免拖慢上报。
- 不作为后台常规统计主查询来源。

### analytics_page_daily

页面每日聚合表。

```text
date
page_id
page_title
page_url
canonical_url
views
visitors
sessions
search_views
internal_views
direct_views
referral_views
social_views
message_count
countries_json
channels_json
devices_json
updated_at
```

第一版可以先不维护复杂 JSON 分布，只维护：

- `views`
- `visitors`
- `sessions`
- `search_views`
- `direct_views`
- `internal_views`
- `referral_views`
- `social_views`
- `message_count`

分布统计第二阶段从 `analytics_events` 聚合生成。

### analytics_page_totals

页面累计总量表，也是前台文章页读取浏览量和留言数的主要表。

```text
page_id
page_title
page_url
canonical_url
views
visitors
sessions
search_views
message_count
last_view_at
last_message_at
updated_at
```

前台文章页需要显示浏览量和留言数时，直接查询这张表：

```http
GET /api/v1/analytics/page?pageId=xxx
```

返回：

```json
{
  "success": true,
  "data": {
    "pageId": "/post/a",
    "pageTitle": "文章标题",
    "pageUrl": "https://example.com/post/a",
    "views": 123,
    "visitors": 45,
    "sessions": 60,
    "messageCount": 8
  }
}
```

这样宿主页面展示 PV 和留言数时不需要分别查 `messages` 和统计表。

### analytics_daily_visitors

每日页面访客去重表。

```text
date
page_id
visitor_id
created_at
UNIQUE(date, page_id, visitor_id)
```

用途：

- 判断某个 visitor 当天访问某页面是否已计入 UV。
- 避免在大事件表里做 `COUNT(DISTINCT visitor_id)`。

### analytics_daily_sessions

每日页面会话去重表。

```text
date
page_id
session_id
created_at
UNIQUE(date, page_id, session_id)
```

用途：

- 判断某个 session 当天访问某页面是否已计入 session 数。
- 避免后台统计扫描原始事件表。

### 留言数同步

`message_count` 写入 `analytics_page_totals` 和 `analytics_page_daily`。

建议规则：

- 新增 approved 留言时，对对应 `page_id` 的 `message_count + 1`。
- 审核 pending 留言变为 approved 时，`message_count + 1`。
- approved 留言被删除或改为 rejected 时，`message_count - 1`。
- pending / rejected 留言不计入前台文章留言数。
- 如果留言系统允许显示全部状态，可改成按业务口径维护 `message_count`。

为了修正异常，可提供管理员维护脚本或接口，按 `messages` 表重新计算某个页面或全站的 `message_count`。

### board_config 增加统计开关

在现有 `board_config` 中增加：

```text
analytics_enabled INTEGER DEFAULT 1
show_view_count INTEGER DEFAULT 1
```

含义：

- `analytics_enabled`: 是否采集并写入流量统计。
- `show_view_count`: 是否在前台 widget 默认显示浏览量。

行为：

- `analytics_enabled = 0` 时，不写入 `analytics_events`，不更新页面聚合表。
- `analytics_enabled = 0` 时，`GET /api/v1/analytics/page` 仍可返回历史统计，用于前台展示已有数据。
- `show_view_count = 0` 时，前台默认不展示浏览量，但宿主页面显式传 `show-view-count="true"` 时可以覆盖。
- `show-view-count` 只控制展示，不控制采集。

后台配置页增加两个开关：

- 流量统计：开启 / 关闭。
- 前台显示浏览量：开启 / 关闭。

建议默认：

```text
analytics_enabled = 1
show_view_count = 1
```

## 计数策略

PV：

- 每次有效上报 +1。

UV：

- 同一天同一 `page_id + visitor_id` 只计一次。
- 通过 `analytics_daily_visitors` 的唯一约束判断是否首次访问。

Session：

- 同一天同一 `page_id + session_id` 只计一次。
- 通过 `analytics_daily_sessions` 的唯一约束判断是否首次会话。

防刷建议：

- 同一 `visitor_id + page_id` 5 秒内重复请求忽略。
- 不建议第一版过度严格限制刷新，因为用户刷新页面通常也可以视为有效 PV。

## 会话与访客标识

widget 在宿主页面生成：

- `visitor_id`: 长期访客 ID，存在宿主站点 `localStorage`。
- `session_id`: 30 分钟无活动过期，可存在 `sessionStorage` 或通过本地时间戳维护。

这些 ID 只用于统计去重。当前方案确认保存真实值，不做 hash。

## API 设计

### 上报访问事件

```http
POST /api/v1/analytics/view
```

请求体示例：

```json
{
  "pageId": "...",
  "pageTitle": "文章标题",
  "pageUrl": "...",
  "canonicalUrl": "https://example.com/post/a",
  "referrer": "...",
  "utm": {
    "source": "...",
    "medium": "...",
    "campaign": "..."
  },
  "channel": "search",
  "screen": {
    "width": 1920,
    "height": 1080
  },
  "viewport": {
    "width": 1280,
    "height": 720
  },
  "deviceType": "desktop",
  "language": "zh-CN",
  "timezone": "Asia/Shanghai",
  "visitorId": "...",
  "sessionId": "..."
}
```

### 查询当前页面统计

```http
GET /api/v1/analytics/page?pageId=xxx
```

返回示例：

```json
{
  "success": true,
  "data": {
    "pageId": "...",
    "pageTitle": "文章标题",
    "pageUrl": "https://example.com/post/a",
    "views": 123,
    "visitors": 45,
    "sessions": 60,
    "messageCount": 8
  }
}
```

### 管理员统计接口

第一版建议：

```http
GET /api/v1/admin/analytics/summary
GET /api/v1/admin/analytics/pages
GET /api/v1/admin/analytics/referrers
GET /api/v1/admin/analytics/channels
GET /api/v1/admin/analytics/search
```

后续可增加：

```http
GET /api/v1/admin/analytics/events
GET /api/v1/admin/analytics/anomalies
GET /api/v1/admin/analytics/opportunities
```

## 与当前项目的结合路径

当前项目已有：

- `functions/api/v1/...` API 结构。
- `lib/middleware.ts` 通用 API handler。
- `lib/response.ts` 响应格式。
- `scheduled.ts` 定时任务。
- `src/widget/components/GuestBoard.ce.vue` widget 主组件。
- Hugo 模板。

建议实现路径：

1. 将流量统计表结构合并到 `sql/001_init.sql`，线上已有数据库使用手动增量 SQL 更新。
2. 新增 `lib/analytics.ts`：渠道归因、设备校验、聚合更新、留言数同步辅助函数。
3. 新增 `functions/api/v1/analytics/view.ts`。
4. 新增 `functions/api/v1/analytics/page.ts`。
5. widget 增加访问上报 composable。
6. widget UI 增加轻量 PV 显示。
7. 留言创建、审核、删除时同步维护 `analytics_page_totals.message_count` 和 `analytics_page_daily.message_count`。
8. 管理后台增加流量概览和内容 SEO 评估表。
9. `scheduled.ts` 增加 90 天前原始事件清理。
10. 后台配置页增加流量统计开关和前台浏览量显示开关。
11. README 增加采集说明和配置项。

## README 采集说明

README 需要增加“流量统计采集说明”，至少包含：

- 会记录页面标题、页面 URL、canonical URL。
- 会记录来源页面、来源域名、UTM 参数和渠道类型。
- 会记录真实 IP、国家、visitor_id、session_id。
- 会记录设备类型、屏幕尺寸、视口尺寸、语言和时区。
- 不采集鼠标轨迹、滚动深度、点击热区、浏览器指纹。
- 原始访问事件默认保留 90 天。
- 页面聚合统计和页面总量长期保留。
- 后台可关闭流量统计采集。
- 前台浏览量显示可单独关闭。

## 推荐 MVP

建议最终确认以下第一版：

- 显示：宿主页面只显示当前页 PV。
- 采集：PV、UV、session、文章标题、页面链接、canonical 链接、来源、渠道、国家、设备、屏幕、语言、时区。
- 隐私：保存真实 IP / visitor / session，不做脱敏和 hash。
- 页面统计：`analytics_page_totals` 同时保存 PV、UV、session 和留言数，前台文章页直接查该表。
- 保留：原始事件 90 天，页面每日聚合和页面总量永久保留。
- 后台：第一版实现流量概览、内容 SEO 评估表、来源渠道和搜索入口分析。
- 防刷：同一 visitor / page 5 秒内重复上报不计数。
- 配置：新增 `analytics_enabled` 和 `show_view_count`，默认开启。
- 文档：README 增加访问数据采集说明。

## 已确认决策

- `show-view-count` 用于控制前台是否显示浏览量，不控制采集。
- `analytics_enabled` 用于控制是否采集和写入流量统计。
- `show_view_count` 默认开启。
- `analytics_enabled` 默认开启。
- README 增加访问数据采集说明。
- 后台配置页增加流量统计开关和前台浏览量显示开关。
- 后台 SEO 评估表第一版采用表格、排序、标签和建议动作，不做繁琐图表。
