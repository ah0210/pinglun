# 流量统计功能技术方案

## 目标

为当前留言板 / 嵌入式 widget 增加流量统计能力：

- 记录每个页面的浏览事件。
- 统计每个页面的浏览量、访客数、会话数。
- 采集来源、渠道、国家、设备、屏幕、语言、时区等分析维度。
- 在宿主页面展示当前页面的浏览量。
- 尽量降低隐私风险和 D1 查询成本。

第一版建议做“隐私友好、可聚合、低成本”的访问统计，不做过度精细的用户追踪。

## 推荐范围

第一版实现：

- 前台 widget 自动上报访问事件。
- 宿主页面默认显示当前页面 PV。
- 数据库存 IP 哈希，不存明文 IP。
- 采集粗粒度设备和来源信息。
- 原始事件保留 90 天，聚合数据长期保留。
- 后台统计页面暂缓，先预留基础 JSON API。

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

## 隐私决策

不存明文 IP。

服务端通过 Cloudflare 获取：

- `CF-Connecting-IP`
- `CF-IPCountry`

生成：

```text
ip_hash = SHA256(ip + ANALYTICS_SALT)
```

`ANALYTICS_SALT` 应放在 Cloudflare Secret 中，不写入代码、数据库或公开配置。

同样，客户端生成的 `visitor_id` 和 `session_id` 入库前也应哈希：

```text
visitor_hash = SHA256(visitor_id + ANALYTICS_SALT)
session_hash = SHA256(session_id + ANALYTICS_SALT)
```

不建议第一版采集或长期保存：

- 明文 IP
- User-Agent 原文
- 鼠标轨迹
- 滚动深度
- 点击热区
- canvas / audio / font 指纹
- 浏览器插件或字体列表

如果未来确实需要安全排查，可另加短期明文 IP 表，保留 7 天。但第一版不建议实现。

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

## 后台建设策略

建议分阶段。

第一阶段：

- 数据表。
- 访问上报 API。
- 当前页面统计查询 API。
- 宿主页面 PV 展示。
- 管理员基础 JSON 接口可选。

第二阶段：

- 后台统计页面。
- 总 PV / UV / session。
- 最近 7 / 30 天趋势。
- Top 页面。
- Top 来源域名。
- 国家分布。
- 渠道分布。
- 设备分布。

这样可以先完成统计闭环，避免后台图表扩大第一版工作量。

## 采集字段

服务端生成或读取：

- `id`
- `page_id`
- `page_url`
- `ip_hash`
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

建议新增三张表。

### analytics_events

原始事件表。

```text
id
page_id
page_url
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
ip_hash
visitor_hash
session_hash
created_at
```

### analytics_daily

每日聚合表。

```text
date
page_id
views
visitors
sessions
countries_json
channels_json
devices_json
updated_at
```

第一版可以先不维护复杂 JSON 分布，只维护：

- `views`
- `visitors`
- `sessions`

分布统计第二阶段从 `analytics_events` 聚合生成。

### analytics_page_totals

页面累计总量表。

```text
page_id
page_url
views
visitors
sessions
last_view_at
updated_at
```

## 计数策略

PV：

- 每次有效上报 +1。

UV：

- 同一天同一 `page_id + visitor_hash` 只计一次。

Session：

- 同一 `page_id + session_hash` 只计一次。

防刷建议：

- 同一 `visitor_hash + page_id` 5 秒内重复请求忽略。
- 不建议第一版过度严格限制刷新，因为用户刷新页面通常也可以视为有效 PV。

## 会话与访客标识

widget 在宿主页面生成：

- `visitor_id`: 长期访客 ID，存在宿主站点 `localStorage`。
- `session_id`: 30 分钟无活动过期，可存在 `sessionStorage` 或通过本地时间戳维护。

这些 ID 只用于统计去重，后端入库前必须哈希。

## API 设计

### 上报访问事件

```http
POST /api/v1/analytics/view
```

请求体示例：

```json
{
  "pageId": "...",
  "pageUrl": "...",
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
    "views": 123,
    "visitors": 45,
    "sessions": 60
  }
}
```

### 管理员统计接口

第二阶段建议：

```http
GET /api/v1/admin/analytics/summary
GET /api/v1/admin/analytics/pages
GET /api/v1/admin/analytics/referrers
```

第一版可以只实现基础 JSON 或暂缓。

## 与当前项目的结合路径

当前项目已有：

- `functions/api/v1/...` API 结构。
- `lib/middleware.ts` 通用 API handler。
- `lib/response.ts` 响应格式。
- `scheduled.ts` 定时任务。
- `src/widget/components/GuestBoard.ce.vue` widget 主组件。
- Hugo 模板。

建议实现路径：

1. 新增 SQL 迁移：`sql/004_add_analytics.sql`。
2. 新增 `lib/analytics.ts`：哈希、渠道、设备校验、聚合更新。
3. 新增 `functions/api/v1/analytics/view.ts`。
4. 新增 `functions/api/v1/analytics/page.ts`。
5. widget 增加访问上报 composable。
6. widget UI 增加轻量 PV 显示。
7. `scheduled.ts` 增加 90 天前原始事件清理。
8. README 增加隐私说明和配置项。

## 推荐 MVP

建议最终确认以下第一版：

- 显示：宿主页面只显示当前页 PV。
- 采集：PV、UV、session、来源、渠道、国家、设备、屏幕、语言、时区。
- 隐私：不存明文 IP，IP / visitor / session 都哈希。
- 保留：原始事件 90 天，聚合数据永久保留。
- 后台：第一版先不做完整图表，只预留或实现基础 JSON 接口。
- 防刷：同一 visitor / page 5 秒内重复上报不计数。
- 配置：新增 `show-view-count`，建议默认开启。

## 待确认问题

- `show-view-count` 是否默认开启。
- 后台基础 JSON 接口是否纳入第一版。
- 是否需要在 README 中明确加入统计隐私说明。
- 是否需要在后台配置页增加统计开关。
