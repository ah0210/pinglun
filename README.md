# 自游人留言板（CF-Guestbook）v1.0.0

基于 **Cloudflare Pages + D1** 的留言板系统，可嵌入 Hugo/FixIt 博客。

## 特性

- 🚀 Cloudflare Pages + D1 部署，全球 CDN 加速
- 🔐 JWT 双 Token 认证（Access 15min + Refresh 7d HttpOnly Cookie）
- 🎨 Web Component Widget，Shadow DOM 样式隔离，支持主题自动跟随
- 📝 秘密留言功能（仅隐藏内容，用户信息正常展示）
- 🛡️ XSS 防护、PBKDF2 密码加密、Turnstile 验证码、连续重复字符检测
- 📏 留言字数限制（可配置最少/最多字数）
- 📊 Naive UI 管理后台（留言审核、用户管理、系统配置、操作日志）
- ✉️ Resend 邮件验证（同步调用，免费 100 封/天）
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
git clone https://github.com/你的用户名/cf-guestbook.git
cd cf-guestbook

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
ALLOWED_ORIGINS = "https://你的博客域名,https://cf-guestbook.pages.dev"
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

向 `http://localhost:8788/api/v1/setup` 发送 POST 请求创建管理员。不能直接在浏览器地址栏访问该接口，因为地址栏会发送 GET 请求。

```bash
curl -X POST http://localhost:8788/api/v1/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@example.com","password":"YourSecurePassword123"}'
```

也可以通过 `.dev.vars` 中的 `ADMIN_USERNAME`、`ADMIN_EMAIL`、`ADMIN_PASSWORD` 环境变量设置默认值，setup 接口会自动读取。

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

以下提供两种部署方式，按推荐优先级排列。

### 方式一：Git 连接 Cloudflare Pages（推荐）

自动化程度最高，推送代码即部署。

#### 步骤 1：推送代码到 GitHub

```bash
git add -A && git commit -m "v1.0.0 release" && git push origin main
```

#### 步骤 2：在 Cloudflare Dashboard 创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create
2. 选择 **Connect to Git**
3. 关联你的 GitHub 仓库
4. 构建设置：
   - **Framework preset**: `None`
   - **Build command**: `pnpm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`（默认）

#### 步骤 3：配置环境变量

在 Pages 项目的 **Settings → Environment variables** 中添加：

**密钥（加密，需点 "Encrypt"）**：

| 变量名 | 说明 |
|--------|------|
| `JWT_SECRET` | 32+ 字符随机密钥，如 `openssl rand -hex 24` 生成 |
| `RESEND_API_KEY` | Resend API Key，格式 `re_xxxxx` |
| `TURNSTILE_SECRET_KEY` | Turnstile 密钥，格式 `0x4AAAAAAA...` |

**非密钥（普通变量，已写入 wrangler.toml 可跳过）**：

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `PUBLIC_URL` | `https://cf-guestbook.pages.dev` | 站点公开 URL |
| `SITE_NAME` | `自游人留言板` | 站点名称 |
| `ALLOWED_ORIGINS` | `https://www.17you.com,https://cf-guestbook.pages.dev` | CORS 允许来源 |
| `EMAIL_DOMAIN` | `17you.com` | Resend 发件域名 |
| `EMAIL_FROM_NAME` | `自游人` | 发件人名称 |

> **注意**：`wrangler.toml` 中的 `[vars]` 仅对 `wrangler pages deploy` 手动部署生效。Git 连接部署需在 Dashboard 中单独配置环境变量。

#### 步骤 4：绑定 D1 数据库

在 Pages 项目的 **Settings → Functions → D1 database bindings** 中：

- **Variable name**: `DB`（必须与代码中的绑定名一致）
- **D1 database**: 选择你创建的 `guestbook` 数据库

#### 步骤 5：配置 Cron 定时任务

在 Pages 项目的 **Settings → Functions → Cron triggers** 中添加：

```
0 0 * * *
```

这将每天 UTC 00:00 触发 `scheduled.ts`，清理过期验证、Token 和登录记录。

#### 步骤 6：初始化远程数据库

```bash
# 初始化表结构
pnpm run db:init:remote

# 插入种子数据
pnpm run db:seed:remote

# 如果是已有部署升级，还需执行增量迁移
npx wrangler d1 execute guestbook --remote --file=sql/006_login_attempts.sql
```

#### 步骤 7：触发首次部署

推送代码后 Pages 会自动构建部署。也可以在 Dashboard 的 Deployments 页面手动 **Retry deployment**。

#### 步骤 8：创建管理员

```bash
curl -X POST https://cf-guestbook.pages.dev/api/v1/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"your_admin","email":"admin@yourdomain.com","password":"YourSecurePassword"}'
```

> **建议**：通过 `wrangler secret put ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` 预设凭据，防止请求体覆盖。创建成功后这些 Secret 可删除。

---

### 方式二：CLI 手动部署

适合不想连接 GitHub 或需要精细控制的场景。

#### 步骤 1：构建项目

```bash
pnpm run build
```

#### 步骤 2：首次部署

```bash
wrangler pages deploy dist --project-name=cf-guestbook
```

首次部署会自动创建 Pages 项目，记住输出的 URL（如 `https://cf-guestbook.pages.dev`）。

#### 步骤 3：绑定 D1 数据库

```bash
# 通过 Dashboard 设置，或使用以下命令（需 Wrangler v3+）
# Settings → Functions → D1 database bindings → 添加 DB = guestbook
```

> D1 绑定目前只能通过 Dashboard 配置，CLI 暂不支持 Pages D1 binding 命令。

#### 步骤 4：设置密钥

```bash
# 生成随机 JWT_SECRET
openssl rand -hex 24

# 设置密钥
wrangler pages secret put JWT_SECRET --project-name=cf-guestbook
wrangler pages secret put RESEND_API_KEY --project-name=cf-guestbook
wrangler pages secret put TURNSTILE_SECRET_KEY --project-name=cf-guestbook
```

#### 步骤 5：初始化数据库 + 创建管理员

```bash
# 初始化远程数据库
pnpm run db:init:remote
pnpm run db:seed:remote

# 创建管理员
curl -X POST https://cf-guestbook.pages.dev/api/v1/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"your_admin","email":"admin@yourdomain.com","password":"YourSecurePassword"}'
```

#### 步骤 6：后续更新

```bash
git pull  # 拉取最新代码
pnpm run build
wrangler pages deploy dist --project-name=cf-guestbook
```

---

### 部署后验证清单

部署完成后，按以下顺序验证：

```bash
# 1. 检查站点可访问
curl -I https://cf-guestbook.pages.dev/api/v1/config
# 期望：200 OK

# 2. 检查缓存头（公开配置可缓存）
curl -I https://cf-guestbook.pages.dev/api/v1/config
# 期望：Cache-Control 包含 public

# 3. 检查留言列表缓存头（防缓存投毒）
curl -I https://cf-guestbook.pages.dev/api/v1/messages
# 期望：Cache-Control: no-store

# 4. 测试注册
curl -X POST https://cf-guestbook.pages.dev/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@yourdomain.com","password":"Test123456","turnstileToken":"1x00000000000000000000AA"}'

# 5. 测试登录
curl -X POST https://cf-guestbook.pages.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"Test123456","turnstileToken":"1x00000000000000000000AA"}'

# 6. 访问管理后台
# 浏览器打开 https://cf-guestbook.pages.dev/admin/

# 7. 访问 Widget 测试页
# 浏览器打开 https://cf-guestbook.pages.dev/test-widget.html

# 8. 验证 D1 绑定
npx wrangler d1 execute guestbook --remote --command "SELECT name FROM _migrations"
# 期望：输出 001_init, 006_login_attempts 等迁移记录

# 9. 检查 login_attempts 表
npx wrangler d1 execute guestbook --remote --command "SELECT COUNT(*) as count FROM login_attempts"
```

---

### 自定义域名（可选）

1. 在 Cloudflare Dashboard → Pages 项目 → Custom domains 添加域名
2. 如域名不在 Cloudflare，需添加 CNAME 记录指向 `cf-guestbook.pages.dev`
3. 更新 `wrangler.toml` 中的 `PUBLIC_URL` 和 `ALLOWED_ORIGINS`
4. 更新 Resend 中的发件域名 DNS 记录

---

### 安全加固建议

| 项目 | 状态 | 建议 |
|------|------|------|
| `.dev.vars` 排除 | ✅ 已在 `.gitignore` | — |
| JWT_SECRET 强度 | ⚠️ 需确认 | 使用 `openssl rand -hex 24` 生成 48 字符密钥 |
| Turnstile 生产密钥 | ⚠️ 需替换 | 本地测试密钥 `1x/2x...` 在生产中无效，需在 [Turnstile Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile) 创建 |
| Resend 域名验证 | ⚠️ 需确认 | 确保 Resend 中已验证发件域名并配置 DNS |
| setup 端点 | ⚠️ 创建管理员后可忽略 | 创建管理员后，`setup_done` 标记永久不可逆，无法重复调用 |
| 管理员密码 | ⚠️ 需修改 | 初始管理员密码建议使用强密码（大小写+数字+特殊字符，6-20位） |
| HTTPS 强制 | ✅ Pages 自动 | Cloudflare Pages 默认强制 HTTPS |

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

### 方式一：Hugo 集成（推荐）

将 `hugo-templates/` 中的文件复制到你的 Hugo 站点：

```
hugo-templates/
├── layouts/partials/footer/custom.html          → Widget 懒加载脚本（自动检测容器进入视口时加载）
├── layouts/partials/post/footer-custom.html     → 文章底部自动嵌入留言板
├── layouts/shortcodes/guestbook.html            → 手动插入短代码
└── config-example.toml                          → 配置参考
```

在 `config.toml` 中添加：

```toml
[params.guestbook]
  enable = true
  apiBase = "https://cf-guestbook.pages.dev"           # 留言板服务地址（自动补全 /api/v1）
  siteKey = "0x4AAAAAADKEiieQVd99LXKI"                  # Turnstile Site Key
  theme = "auto"                                         # "light" | "dark" | "auto"
  maxLength = 500                                        # 留言最大字数
  minLength = 2                                          # 留言最小字数
```

在文章 Front Matter 中可关闭留言板：

```yaml
guestbook: false
```

或使用短代码手动插入：

```markdown
{{</* guestbook pageId="/about/" */>}}
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

在网站导航栏展示认证状态，使用 `<gb-auth-bar>` Web Component：

```html
<!-- HTML 标签方式 -->
<gb-auth-bar api-base="https://your-domain.com/api/v1" theme="auto"></gb-auth-bar>

<!-- JS API 方式（自动从页面上的 guestbook-widget 读取 apiBase 和 theme） -->
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
| `style-src` | `your-domain.com` | 内联样式（adoptedStyleSheets） |
| `img-src` | `cravatar.cn` | Gravatar 头像 |
| `connect-src` | `your-domain.com` | API 请求 |

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
cf-guestbook/
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
- 密码使用 PBKDF2-SHA256（600000 次迭代）加密，密码长度限制 6-20 字符（防 PBKDF2 DoS）
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

# 4. 初始化管理员
curl -X POST http://localhost:8788/api/v1/setup \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@test.com","password":"Test123456"}'

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

# 远程环境执行迁移
pnpm run db:migrate:remote  # 需先在 package.json 中添加对应脚本
# 或手动执行：
npx wrangler d1 execute guestbook --remote --file=sql/006_login_attempts.sql
```

## 许可

本软件使用自定义许可协议，详见 [LICENSE](./LICENSE) 文件。

- ✅ 允许个人非商业用途使用、修改和分发
- 🚫 禁止商业用途
- 🚫 禁止移除或修改版权声明和许可声明

版权所有 © 自游人 https://www.17you.com/
