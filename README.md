# 自游人留言板（you-guestbook）v1.0.0

基于 **Cloudflare Pages + D1** 的留言板系统，可嵌入 Hugo/FixIt 博客。

## 特性

- 🚀 Cloudflare Pages + D1 部署，全球 CDN 加速
- 🔐 JWT 双 Token 认证（Access 15min + Refresh 7d HttpOnly Cookie）
- 🎨 Web Component Widget，Shadow DOM 样式隔离，支持主题自动跟随
- 📝 秘密留言功能（仅隐藏内容，用户信息正常展示）
- 🛡️ XSS 防护、PBKDF2 密码加密、Turnstile 验证码、连续重复字符检测
- 📏 留言字数限制（可配置最少/最多字数）
- 📊 Naive UI 管理后台（留言审核、用户管理、系统配置、操作日志）
- ✉️ Resend 邮件验证（同步调用，免费 100 封/天，国内投递优化提示见下方）
- 🔑 找回/重置密码（邮箱发送重置链接，Token Hash 存储，1 小时过期）
- 📧 修改邮箱（密码验证 + 重新验证 + Gravatar 自动更新）
- ✅ 邮箱验证才能留言（前后端双重拦截，管理员豁免）
- 🪟 认证弹窗系统（登录/注册/找回密码/重置密码/修改密码/修改邮箱）
- 🧭 导航栏认证栏（`<gb-auth-bar>` Web Component + `window.GuestBoard` 全局 API）
- 📱 移动端优化（消除双击延迟、44px 最小触摸区域、`:active` 替代 `:hover`）
- 🔄 CORS 跨域支持、Gravatar 头像自动生成、API 错误码体系统一

## 快速开始

### 1. 前置准备

确保你已完成以下操作：

- [ ] 注册 [Cloudflare](https://dash.cloudflare.com) 账号
- [ ] 创建 D1 数据库（名称 `guestbook`）
- [ ] 创建 [Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) 应用
- [ ] 注册 [Resend](https://resend.com) 获取 API Key
- [ ] 安装依赖管理器：`corepack enable`
- [ ] 登录 Cloudflare：`pnpm exec wrangler login`
- [ ] 创建 GitHub 仓库

### 2. 配置环境

```bash
# 克隆项目
git clone https://github.com/ah0210/you-guestbook.git
cd you-guestbook

# 安装依赖
pnpm install

# 复制环境变量模板
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars 填入你的密钥
```

### 3. 更新 wrangler.toml

修改 `wrangler.toml` 中的配置：

```toml
database_id = "你的D1数据库ID"
ALLOWED_ORIGINS = "https://你的博客域名,https://you-guestbook.pages.dev"
EMAIL_DOMAIN = "你的Resend验证域名"
```

### 4. 本地开发

```bash
# 初始化本地数据库
pnpm run db:init
pnpm run db:seed

# 启动本地开发服务器（先构建再启动）
pnpm run dev
```

`pnpm run dev` 会先构建到 `dist/`，再通过 `wrangler pages dev dist` 启动本地 Pages 环境。
Wrangler 会输出类似 `Ready on http://127.0.0.1:8788` 的地址，本地调试访问 `http://127.0.0.1:8788/`；后台地址为 `/admin/`，API 地址仍为 `/api/v1`。

#### 本地数据库管理

```bash
# 查询数据
npx wrangler d1 execute guestbook --local --command "SELECT * FROM users"
npx wrangler d1 execute guestbook --local --command "SELECT * FROM board_config"

# 执行 SQL 文件
npx wrangler d1 execute guestbook --local --file=sql/001_init.sql

# 重置本地数据库：删除 .wrangler/state/v3/d1 目录后重新执行
pnpm run db:init && pnpm run db:seed

# 操作远程数据库（加 --remote，需先 wrangler login）
npx wrangler d1 execute guestbook --remote --command "SELECT * FROM users"
```

### 5. 本地测试 Widget 嵌入

如果需要在本地 Hugo 站点中测试留言板 Widget，需额外配置：

#### 5.1 修改 `.dev.vars`

```bash
# 添加本地 CORS 来源（Hugo 默认端口 1313）
ALLOWED_ORIGINS=http://localhost:1313,https://你的生产域名

# Turnstile 不支持 localhost，改用 Cloudflare 官方测试密钥
# 1x...AA = 交互式挑战（测试用），2x...AA = 自动通过
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

#### 5.2 启动两个服务

```bash
# 终端 1：启动留言板后端
pnpm build && npx wrangler pages dev dist

# 终端 2：启动 Hugo 站点
hugo server
```

#### 5.3 Hugo 模板中 Widget 配置

确保 Hugo 模板中的 widget 指向本地服务：

```html
<guestbook-widget
  api-base="http://localhost:8788"
  site-key="1x00000000000000000000AA"
  page-id="/your-page"
/>
```

#### 5.4 快速验证 Widget 是否正常

```bash
# 一键构建 + 复制测试页 + 启动开发服务器
pnpm run test:widget
```

或在浏览器中访问 `http://127.0.0.1:8788/test-widget.html`，页面会自动检测 API/JS/CSS 是否可用并渲染留言板。

测试页面提供了两种 Widget 嵌入方式：
- **JS 初始化**：通过 `GuestbookWidget.init()` API 动态创建
- **HTML 标签**：直接使用 `<guestbook-widget>` 自定义元素

### 6. 初始化管理员

**第一个注册的用户自动成为管理员**，无需独立 setup 步骤。

```bash
# 注册第一个用户（自动成为管理员）
curl -X POST http://localhost:8788/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@example.com","password":"YourSecurePassword123","turnstileToken":"1x00000000000000000000AA"}'

# 后续注册的用户为普通用户
```

本地数据库资源管理器：`http://127.0.0.1:8788/cdn-cgi/explorer/`

### 7. 构建和部署

```bash
# 构建
pnpm run build

# 类型检查
pnpm run typecheck
```

管理后台构建入口为 `/admin/index.html`，部署后可访问 `/admin/`。`public/_redirects` 已配置 `/admin/*` 回退到后台入口，支持刷新后台子路由。

### 8. 远程数据库初始化

```bash
pnpm run db:init:remote
pnpm run db:seed:remote
```

### 9. 设置生产密钥

```bash
wrangler secret put JWT_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put TURNSTILE_SECRET_KEY
```

## 线上部署指南


### 首次部署步骤（已完成，仅供参考）

1. Dashboard → 构建 → 计算 → Workers & Pages → 创建应用程序Create →  (不要选continue with github!) 往下拉看到：想要部署 Pages？点击：开始使用
2. 导入现有 Git 存储库 从导入现有 Git 存储库开始。 → 从您的帐户部署站点 → 选择一个存储库 `ah0210/pinglun`
3. 构建设置：构建命令Build command = `pnpm run build`，构建输出目录Output = `dist` 
4. **环境变量**（Settings → Environment variables）：加密添加 `JWT_SECRET`、`RESEND_API_KEY`、`TURNSTILE_SECRET_KEY`
5. **D1 绑定**（Settings → Functions → D1 database bindings）：`DB` → `guestbook`
6. **自定义域名**（Settings → Custom domains）：添加 `guestbook.17you.com`
7. **初始化数据库**：`pnpm run db:init:remote && pnpm run db:seed:remote`
8. **创建管理员**：`POST /api/v1/setup`

### 后续日常开发流程

```bash
# 本地修改 → 提交 → 推送 → 自动部署
git add -A
git commit -m "修改说明"
git push origin main
```

Cloudflare 自动构建部署，约 2-3 分钟生效。

> **注意**：`wrangler.toml` 中的 `[vars]`（PUBLIC_URL 等）**对 Git 连接部署不生效**，须在 Dashboard 环境变量中配置。

---

### 配置摘要

| 配置项 | 值 |
|--------|-----|
| 访问地址 | `https://guestbook.17you.com` |
| 回退域名 | `https://pinglun-9ve.pages.dev` |
| D1 绑定 | `DB` → `guestbook` |
| 加密变量 | JWT_SECRET / RESEND_API_KEY / TURNSTILE_SECRET_KEY |
| CORS | `https://www.17you.com,https://guestbook.17you.com` |

### 验证清单

```bash
# API
curl https://guestbook.17you.com/api/v1/config

# 缓存头
curl -I https://guestbook.17you.com/api/v1/config    # 期望 public
curl -I https://guestbook.17you.com/api/v1/messages   # 期望 no-store

# 管理后台
# 浏览器打开 https://guestbook.17you.com/admin/

# Widget 测试页
# 浏览器打开 https://guestbook.17you.com/test-widget.html
```

### Cron 定时任务（可选）

业务逻辑中已有自清理机制，Cron 按需配置：

| 数据 | 自清理时机 |
|------|-----------|
| 登录尝试记录 | 登录成功时自动清理 |
| 邮箱验证记录 | 验证成功后自动删除 |
| Refresh Token | 登录 / 刷新时自动清理过期+吊销 |

如需配置：Dashboard → **Settings → Functions → Cron triggers** → 添加 `0 0 * * *`

### 安全提示

| 项目 | 说明 |
|------|------|
| Turnstile 密钥 | Dashboard 需配置**生产**密钥（非测试密钥 `1x/2x...`） |
| Resend 域名 | 确认 `17you.com` 已在 Resend 完成 DNS 验证 |
| JWT_SECRET | Dashboard 加密变量中已配置 |
```

## 数据库升级

## 数据库升级

v1.0.0 已将所有表结构合并到 `sql/001_init.sql`，新部署只需执行 `db:init` + `db:seed` 即可。

如果未来版本需要升级数据库，请按以下步骤操作：

### 1. 创建迁移脚本

在 `sql/` 目录下创建新的迁移文件，命名格式 `00N_description.sql`（N 为序号，如 `006_add_new_field.sql`）：

```sql
-- 迁移：006_add_new_field
-- 日期：2026-xx-xx
-- 说明：为 users 表新增 xxx 字段

ALTER TABLE users ADD COLUMN new_field TEXT DEFAULT '';

-- 记录迁移
INSERT OR IGNORE INTO _migrations (name) VALUES ('006_add_new_field');
```

### 2. 在 package.json 中添加迁移脚本

```json
{
  "scripts": {
    "db:migrate:v4": "wrangler d1 execute guestbook --local --file=sql/006_add_new_field.sql",
    "db:migrate:v4:remote": "wrangler d1 execute guestbook --remote --file=sql/006_add_new_field.sql"
  }
}
```

### 3. 执行迁移

```bash
# 本地
pnpm run db:migrate:v4

# 远程
pnpm run db:migrate:v4:remote
```

### 4. 更新 001_init.sql

同时将新字段/表同步到 `001_init.sql` 中，确保新部署的用户使用 `db:init` 即可获得完整最新的数据库结构，并更新 `_migrations` 表的插入记录。

> **注意**：`_migrations` 表用于追踪已执行的迁移，防止重复执行。所有迁移脚本应包含 `INSERT OR IGNORE INTO _migrations` 语句。

## 页面集成

留言板以 Web Component 形式嵌入宿主页面，支持 Hugo 和任意网站。

### 方式一：Hugo/FixIt 集成（推荐）

将 `hugo-templates/` 中的文件复制到你的 Hugo 站点：

```
hugo-templates/
├── layouts/partials/custom/
│   ├── guestbook-head.html      → <head> 预连接（preconnect）
│   ├── gb-auth-bar.html         → 导航栏认证栏（桌面端+移动端）
│   ├── guestbook.html           → 评论区留言板组件
│   └── guestbook-footer.html    → 页面底部JS懒加载 + 暗色模式同步
└── config-example.toml          → 配置参考
```

在 `config.toml` 中添加：

```toml
# 留言板参数
[params.guestbook]
  enable = true
  apiBase = "https://guestbook.17you.com"           # 留言板服务地址（自动补全 /api/v1）
  siteKey = "0x4AAAAAADKEiieQVd99LXKI"              # Turnstile Site Key
  theme = "auto"                                     # "light" | "dark" | "auto"

# FixIt 主题 customPartials 注入点
[params.customPartials]
  head = ["custom/guestbook-head.html"]                              # <head> 预连接
  menuDesktop = ["custom/gb-auth-bar.html"]                          # 桌面端导航栏认证栏
  menuMobile = ["custom/gb-auth-bar.html"]                           # 移动端导航栏认证栏
  profile = []
  aside = []
  comment = ["custom/guestbook.html"]                                 # 评论区留言板
  footer = []
  widgets = []
  assets = ["custom/guestbook-footer.html"]                           # 页面底部JS+主题同步
```

在文章 Front Matter 中可关闭留言板：

```yaml
guestbook: false
```

### 方式二：任意页面集成

#### 1. 加载 Widget JS

```html
<script defer src="https://your-domain.com/widget.js"></script>
```

#### 2. 插入容器并初始化

```html
<div id="guestbook"></div>
<script>
GuestbookWidget.init({
  container: '#guestbook',
  pageId: '/about/',              // 当前页面标识，用于区分不同页面的留言
  apiBase: 'https://your-domain.com',
  siteKey: '0x4AAAAAAA...',       // Turnstile Site Key
  theme: 'auto',                  // "light" | "dark" | "auto"
  maxLength: 500
});
</script>
```

或直接使用 HTML 标签（需确保 `widget.js` 已加载）：

```html
<guestbook-widget
  api-base="https://your-domain.com/api/v1"
  site-key="0x4AAAAAAA..."
  page-id="/about/"
  theme="auto"
  max-length="500"
/>
```

### 自定义主题样式

留言板和认证栏均使用 CSS 变量控制样式，变量从宿主页面穿透 Shadow DOM 生效。在宿主页面中覆盖 `--guestbook-*` 变量即可自定义主题：

```css
/* 全局设置，所有留言板组件继承 */
:root {
  --guestbook-primary: #e74c3c;
  --guestbook-primary-hover: #d4402e;
  --guestbook-font-family: "LXGW WenKai", sans-serif;
  --guestbook-border-radius: 4px;
}

/* 按组件单独设置 */
guestbook-widget {
  --guestbook-primary: #e74c3c;
}
gb-auth-bar {
  --guestbook-primary: #3498db;
}

/* 直接在 HTML 属性中 */
<guestbook-widget
  style="--guestbook-primary: #e74c3c"
  ...
/>
```

#### 完整 CSS 变量清单

| 变量名 | 默认值 | 暗色默认值 | 说明 |
|--------|--------|-----------|------|
| `--guestbook-primary` | `#4a6cf7` | — | 主色调（按钮、链接、高亮） |
| `--guestbook-primary-hover` | `#3b5de7` | — | 主色调 hover 状态 |
| `--guestbook-bg` | `#ffffff` | `#1a1a2e` | 背景色 |
| `--guestbook-bg-secondary` | `#f7f8fa` | `#16213e` | 次要背景色（输入框背景、提示区） |
| `--guestbook-text` | `#333333` | `#e0e0e0` | 主文字色 |
| `--guestbook-text-secondary` | `#666666` | `#a0a0a0` | 次要文字色（时间、提示） |
| `--guestbook-border` | `#e0e0e0` | `#2d2d44` | 边框色 |
| `--guestbook-border-radius` | `8px` | — | 圆角大小 |
| `--guestbook-shadow` | `0 2px 8px rgba(0,0,0,0.08)` | `0 2px 8px rgba(0,0,0,0.3)` | 阴影 |
| `--guestbook-font-size` | `14px` | — | 字号 |
| `--guestbook-font-family` | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` | — | 字体族 |

> 暗色默认值在 `theme="dark"` 时自动生效，也可单独覆盖。

### 暗色模式同步

```html
<!-- 方式一：跟随系统偏好（默认行为，无需额外配置） -->
<guestbook-widget theme="auto" ... />

<!-- 方式二：强制指定 -->
<guestbook-widget theme="dark" ... />

<!-- 方式三：与宿主主题 JS 联动（如 Hugo FixIt 主题通过 html.dark 切换） -->
<script>
function syncTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  document.querySelectorAll('guestbook-widget, gb-auth-bar').forEach(el => {
    el.setAttribute('theme', isDark ? 'dark' : 'light');
  });
}
// 监听宿主主题切换
new MutationObserver(syncTheme)
  .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
syncTheme();
</script>
```

### 导航栏认证栏

在网站导航栏展示认证状态，使用 `<gb-auth-bar>` Web Component。

Hugo/FixIt 集成已通过 `gb-auth-bar.html` 模板自动注入，无需手动添加。

其他网站可手动嵌入：

```html
<!-- HTML 标签方式（apiBase 必填，siteKey 和 forceSkipTurnstile 由 AuthBar 自动从 /api/v1/config 获取） -->
<gb-auth-bar api-base="https://your-domain.com" theme="auto"></gb-auth-bar>

<!-- JS API 方式（需页面上已有 guestbook-widget，自动读取 apiBase 和 theme） -->
<script>
GuestBoard.mountAuthBar('#nav-auth');
</script>
```

### 全局 JS API

Widget 加载后自动暴露 `window.GuestBoard` 全局对象：

```js
// 获取当前用户
GuestBoard.getUser();  // PublicUser | null

// 打开认证弹窗
GuestBoard.openAuth('login');       // 登录
GuestBoard.openAuth('register');    // 注册
GuestBoard.openAuth('forgot-password');  // 找回密码

// 退出登录
GuestBoard.logout();

// 监听认证状态变化
const unsub = GuestBoard.onAuthChange((user) => {
  console.log(user ? `已登录: ${user.username}` : '未登录');
});

// 挂载认证栏到指定容器
GuestBoard.mountAuthBar('#nav-auth');

// 卸载认证栏
GuestBoard.unmountAuthBar();
```

### 通过 CustomEvent 触发（纯 HTML 可用）

```html
<button onclick="document.dispatchEvent(new CustomEvent('gb-open-auth', {detail:{mode:'login'},composed:true}))">登录</button>
<button onclick="document.dispatchEvent(new CustomEvent('gb-open-auth', {detail:{mode:'register'},composed:true}))">注册</button>
```

### CSP 策略

如果宿主页面启用了 Content Security Policy，需允许以下域名：

| 指令 | 域名 | 用途 |
|------|------|------|
| `script-src` | `your-domain.com` | widget.js |
| `script-src` | `challenges.cloudflare.com` | Turnstile 验证码脚本 |
| `style-src` | `your-domain.com` | 内联样式（adoptedStyleSheets） |
| `frame-src` | `challenges.cloudflare.com` | Turnstile iframe |
| `img-src` | `cravatar.cn` | Gravatar 头像 |
| `connect-src` | `your-domain.com` | API 请求 |
| `connect-src` | `challenges.cloudflare.com` | Turnstile 验证通信 |

> **注意**：如果宿主页面启用了 `require-trusted-types` 策略，Turnstile 可能无法正常工作。
> 此时建议在 CSP 中为 Turnstile 脚本添加豁免，或暂时关闭 Trusted Types 策略。

## API 端点

### 公开 API

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/v1/config` | 无 | 留言板配置 |
| POST | `/api/v1/auth/register` | Turnstile | 用户注册 |
| POST | `/api/v1/auth/login` | Turnstile | 登录 |
| POST | `/api/v1/auth/refresh` | Cookie | 刷新 Token |
| POST | `/api/v1/auth/logout` | Cookie | 登出 |
| GET | `/api/v1/auth/verify-email` | 无 | 邮箱验证 |
| GET | `/api/v1/auth/me` | JWT | 当前用户 |
| PATCH | `/api/v1/auth/me` | JWT | 修改资料 |
| POST | `/api/v1/auth/change-password` | JWT | 修改密码 |
| POST | `/api/v1/auth/resend-verification` | JWT | 重发验证邮件 |
| POST | `/api/v1/auth/forgot-password` | Turnstile | 忘记密码（发送重置邮件） |
| POST | `/api/v1/auth/reset-password` | 无 | 重置密码（Token 验证） |
| POST | `/api/v1/auth/change-email` | JWT | 修改邮箱 |
| GET | `/api/v1/messages` | 可选 | 留言列表 |
| POST | `/api/v1/messages` | JWT + Turnstile + 邮箱验证 | 提交留言 |
| GET | `/api/v1/messages/:id` | JWT（秘密） | 单条留言 |
| POST | `/api/v1/setup` | 无 | 初始化管理员 |

### 管理员 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/admin/stats` | 数据统计 |
| GET | `/api/v1/admin/messages` | 留言管理列表 |
| PATCH | `/api/v1/admin/messages/:id` | 审核留言 |
| DELETE | `/api/v1/admin/messages/:id` | 删除留言 |
| POST | `/api/v1/admin/messages/batch-delete` | 批量删除 |
| GET | `/api/v1/admin/users` | 用户列表 |
| PATCH | `/api/v1/admin/users/:id` | 变更角色/状态 |
| GET/POST | `/api/v1/admin/config` | 系统配置 |
| POST | `/api/v1/admin/cleanup` | 手动清理 |
| GET | `/api/v1/admin/logs` | 操作日志 |

## 项目结构

```
you-guestbook/
├── functions/api/v1/    → 后端 API（Pages Functions）
│   └── auth/            → 认证相关（注册/登录/找回密码/重置密码/修改邮箱等）
├── lib/                  → 共享工具库
├── sql/                  → 数据库脚本
├── src/
│   ├── widget/           → 留言板 Widget（Web Component）
│   │   └── components/   → AuthModal / UserDropdown / AuthBar / GuestBoard
│   ├── admin/            → 管理后台 SPA（Naive UI）
│   └── shared/           → 共享前端代码
├── hugo-templates/       → Hugo 集成文件
└── scheduled.ts          → Cron 定时清理
```

## 免费额度

| 服务 | 免费额度 | 预估用量 |
|------|----------|----------|
| Workers 请求 | 100K/天 | 远低于 |
| D1 读取 | 500万行/天 | 远低于 |
| D1 写入 | 10万行/天 | 远低于 |
| Resend 邮件 | 100封/天 | 取决于注册量 |
| Turnstile | 无限制 | — |

## 安全

- JWT_SECRET 使用随机生成的 32+ 字符密钥
- 密码使用 PBKDF2-SHA256（100000 次迭代）加密，密码长度限制 8-20 字符（防 PBKDF2 DoS）
- Refresh Token 存储在 HttpOnly Cookie（SameSite=None; Secure）
- 所有用户输入入库前 HTML 转义
- CORS 仅允许配置的域名
- 管理员操作全部记录审计日志
- 密码重置 Token 使用 SHA-256 Hash 存储，不明文保存
- 找回密码防邮箱枚举（无论邮箱是否存在均返回相同提示）
- 找回密码双维度频率限制（邮箱 1 次/分钟 + IP 3 次/5分钟）
- 邮箱验证前后端双重拦截留言，管理员豁免
- 登录频率限制基于 D1 数据库（IP + 用户名双维度），解决 Serverless 内存隔离问题
- 最后管理员保护（禁止降级最后一个管理员的角色）
- API 响应不泄露用户邮箱（`toPublicUser` 已移除 email 字段）
- 用户数据端点使用 `private` Cache-Control（防 CDN 缓存敏感数据）
- 留言列表端点使用 `no-store` Cache-Control（防 CDN 缓存投毒）
- 游标分页替代 OFFSET 分页（防深分页性能劣化）
- 留言列表移除 `COUNT(*)` 查询（使用 limit+1 判断是否有更多）
- 邮件模板中 URL 注入防护（仅允许 http/https 协议，使用 URL 对象编码）
- 异步邮件发送使用 `ctx.waitUntil()` 确保 Workers 不会提前终止

## 系统容错与紧急降级

### D1 写入瓶颈处理

D1 基于 SQLite，写入串行化。正常 QPS 下不会触发问题，但如果遭遇恶意灌水，可能出现 `SQLITE_BUSY` 错误。项目已在全局中间件中识别该错误并返回友好提示：

- 用户看到：`{"error":{"code":9006,"message":"系统繁忙，请稍后重试"}}`（HTTP 503）
- 其他未预期的内部错误不再暴露 SQL 语句/表名等敏感信息

### 紧急降级开关

Admin 后台「系统配置」页面新增两个紧急降级开关：

| 开关 | 作用 | 使用场景 |
|------|------|---------|
| **邮箱验证** | 关闭后用户无需验证邮箱即可留言 | Resend 宕机或邮件投递大面积失败时 |
| **🚨 跳过验证码** | 关闭后所有操作跳过 Turnstile 验证 | Turnstile API 宕机导致注册/登录/发帖全部不可用时 |

> ⚠️ 跳过验证码是紧急降级措施，仅在确认第三方服务不可用时临时开启，恢复后应立即关闭。

## 邮件投递优化（Resend + 国内邮箱）

项目默认使用 [Resend](https://resend.com) 发送验证码和密码重置邮件。Resend 的发送 IP 主要在海外，国内主流邮箱（QQ、网易 163/126 等）对境外 IP 投递策略较严格，可能导致邮件进垃圾箱或被拒收。

### 立即可做的优化

1. **配置自定义域名 SPF/DKIM/DMARC**：在 Resend 中绑定自有域名并完成 DNS 验证，这能显著提升邮件信誉度和到达率
2. **优化邮件内容**：避免触发垃圾邮件关键词（如"免费""中奖"），保持 HTML 简洁
3. **UI 提示用户检查垃圾箱**：在验证邮件发送后提示"如未收到，请检查垃圾邮件箱"
4. **重发验证邮件**：项目已内置 `/auth/resend-verification` 接口，用户可重新发送

### 如果 Resend 投递效果仍不理想

可考虑切换到国内邮件服务，仅修改 `lib/email.ts` 的发送逻辑即可。以下是主流国内服务的最新免费额度对比：

| 服务 | 免费额度 | 超出后单价 | 国内送达率 | API 协议 | 推荐场景 |
|------|----------|-----------|-----------|---------|---------|
| **腾讯云 SES** | **1000 封/账户**（永久有效，用完为止） | 0.0019 元/封 | ★★★★★ | REST API | QQ 邮箱天然信任，送达率最高 |
| **阿里云 DirectMail** | **2000 封/账户**（每天最多 200 封免费） | 按量阶梯计费 | ★★★★★ | REST API + SMTP | 163/126 友好，额度最多 |
| **SendCloud** | **10 封/天**（可邮件申请提升至 200 封/天） | 付费套餐起步 | ★★★★ | REST API + SMTP | 国内老牌，开发者友好 |
| **Resend**（当前） | **100 封/天** | $0.1/千封 | ★★★ | REST API | 海外邮箱友好，配置最简 |

> **推荐**：如需切换，**腾讯云 SES** 是首选——QQ 邮箱送达率极高（同属腾讯生态），1000 封免费额度对中小留言板足够用很久，且 REST API 集成简单。

## 测试

### 类型检查

```bash
pnpm run typecheck
```

### 构建验证

```bash
pnpm run build
```

### 本地完整测试流程

```bash
# 1. 安装依赖
pnpm install

# 2. 初始化本地数据库（首次）
pnpm run db:init
pnpm run db:seed

# 3. 构建并启动本地服务
pnpm run dev

# 4. 注册第一个用户（自动成为管理员）
curl -X POST http://localhost:8788/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@test.com","password":"Test123456","turnstileToken":"1x00000000000000000000AA"}'

# 5. 测试注册（需先配置 .dev.vars 中的 Turnstile 测试密钥）
curl -X POST http://localhost:8788/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@test.com","password":"Test123456","turnstileToken":"1x00000000000000000000AA"}'

# 6. 测试登录
curl -X POST http://localhost:8788/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test123456","turnstileToken":"1x00000000000000000000AA"}'

# 7. 测试忘记密码
curl -X POST http://localhost:8788/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","turnstileToken":"1x00000000000000000000AA"}'

# 8. 测试修改邮箱（需替换 <ACCESS_TOKEN>）
curl -X POST http://localhost:8788/api/v1/auth/change-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"newEmail":"newemail@test.com","currentPassword":"Test123456"}'

# 9. 测试修改密码（需替换 <ACCESS_TOKEN>）
curl -X POST http://localhost:8788/api/v1/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"currentPassword":"Test123456","newPassword":"NewPass123456"}'

# 10. 访问 Widget 测试页
# 浏览器打开 http://127.0.0.1:8788/test-widget.html
```

### 测试页面验证

```bash
# 一键构建 + 复制测试页 + 启动开发服务器
pnpm run test:widget
```

浏览器访问 `http://127.0.0.1:8788/test-widget.html`，页面会自动检测 API/JS/CSS 并渲染留言板。

### 安全与性能测试建议

以下针对 v1.0.0 安全加固项的专项测试，建议部署前逐一验证：

#### 1. 密码长度限制（防 PBKDF2 DoS）

```bash
# 超长密码应被拒绝（> 20 字符）
curl -X POST http://localhost:8788/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"dosuser","email":"dos@test.com","password":"AAAAAAAAAABBBBBBBBBB1","turnstileToken":"1x00000000000000000000AA"}'
# 期望：400 错误，提示密码不能超过 20 个字符

# 边界：恰好 20 字符应通过
curl -X POST http://localhost:8788/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"boundaryuser","email":"boundary@test.com","password":"AAAAAAAAAABBBBBBBBB1","turnstileToken":"1x00000000000000000000AA"}'
# 期望：注册成功
```

#### 2. D1 登录频率限制

```bash
# 连续错误登录 5 次后应被临时锁定
for i in {1..6}; do
  curl -s -X POST http://localhost:8788/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","password":"WrongPass${i}","turnstileToken":"1x00000000000000000000AA"}'
  echo ""
done
# 期望：前 5 次返回 401，第 6 次返回 429（请求过于频繁）

# 检查 login_attempts 表是否正确记录
npx wrangler d1 execute guestbook --local --command "SELECT * FROM login_attempts ORDER BY attempted_at DESC LIMIT 10"
```

#### 3. 缓存头验证（防 CDN 缓存投毒）

```bash
# 留言列表应为 no-store（防止匿名用户看到其他用户的私有数据）
curl -I http://localhost:8788/api/v1/messages
# 期望：Cache-Control: no-store

# 公开配置端点可缓存
curl -I http://localhost:8788/api/v1/config
# 期望：Cache-Control: public, max-age=60（或类似）

# 用户数据端点应为 private
curl -I -H "Authorization: Bearer <ACCESS_TOKEN>" http://localhost:8788/api/v1/auth/me
# 期望：Cache-Control: private, ...
```

#### 4. 游标分页验证

```bash
# 第一页请求（无 cursor）
curl -s "http://localhost:8788/api/v1/messages?limit=5" | python -m json.tool
# 期望响应格式：{ "items": [...], "limit": 5, "nextCursor": "...", "hasMore": true/false }

# 第二页请求（使用上一次返回的 nextCursor）
curl -s "http://localhost:8788/api/v1/messages?limit=5&cursor=<NEXT_CURSOR>" | python -m json.tool
# 期望：返回下一批数据，无重复

# 验证不再返回 total 字段
# 期望：响应中无 "total" 字段
```

#### 5. 邮箱泄露检查

```bash
# 留言列表不应包含邮箱
curl -s "http://localhost:8788/api/v1/messages" | python -m json.tool
# 期望：用户对象中无 email 字段

# 单条留言详情不应包含邮箱
curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "http://localhost:8788/api/v1/messages/<MESSAGE_ID>" | python -m json.tool
# 期望：用户对象中无 email 字段

# 当前用户接口可返回自己的邮箱
curl -s -H "Authorization: Bearer <ACCESS_TOKEN>" "http://localhost:8788/api/v1/auth/me" | python -m json.tool
# 期望：仅此接口返回 email（用户自己的数据）
```

#### 6. 最后管理员保护

```bash
# 确保系统中只有一个管理员，尝试降级其角色
curl -s -X PATCH "http://localhost:8788/api/v1/admin/users/<ADMIN_USER_ID>" \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"role":"user"}'
# 期望：403 错误，提示无法降级最后一个管理员
```

#### 7. 秘密留言权限（作者可查看自己的待审核留言）

```bash
# 用普通用户提交留言（设置 is_secret=true 或等待审核状态为 pending）
# 然后用该用户身份请求单条留言
curl -s -H "Authorization: Bearer <USER_ACCESS_TOKEN>" "http://localhost:8788/api/v1/messages/<PENDING_MESSAGE_ID>"
# 期望：作者可查看自己待审核的留言内容（其他人应被拒绝）
```

#### 8. URL 注入防护（邮件模板）

```bash
# 注册时使用 javascript: 协议的网站 URL（如果支持网站字段）
# 或手动触发修改邮箱流程，检查重置链接是否仅包含 http/https URL
# 期望：非 http/https 协议的 URL 被拒绝或替换为空
```

#### 9. 异步邮件可靠性

```bash
# 注册新用户，观察邮件是否正常发送
# 关键：Workers 不会因响应提前返回而中断邮件发送
# 可通过检查 Resend 控制台日志确认邮件投递状态
```

#### 10. 数据库迁移验证

```bash
# 确认 login_attempts 表已创建
npx wrangler d1 execute guestbook --local --command "SELECT sql FROM sqlite_master WHERE name='login_attempts'"
# 期望：输出建表语句
```

## 许可

本软件使用自定义许可协议，详见 [LICENSE](./LICENSE) 文件。

- ✅ 允许个人非商业用途使用、修改和分发
- 🚫 禁止商业用途
- 🚫 禁止移除或修改版权声明和许可声明

版权所有 © 自游人 https://www.17you.com/
