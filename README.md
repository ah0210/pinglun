# 自游人留言板（CF-Guestbook）

基于 **Cloudflare Pages + D1** 的留言板系统，可嵌入 Hugo/FixIt 博客。

## 特性

- 🚀 Cloudflare Pages + D1 部署，全球 CDN 加速
- 🔐 JWT 双 Token 认证（Access 15min + Refresh 7d HttpOnly Cookie）
- 🎨 Web Component Widget，Shadow DOM 样式隔离，支持主题自动跟随
- 📝 秘密留言功能（留言者 + 管理员可见）
- 🛡️ XSS 防护、PBKDF2 密码加密、Turnstile 验证码
- 📊 Naive UI 管理后台（留言审核、用户管理、系统配置、操作日志）
- ✉️ Resend 邮件验证（同步调用，免费 100 封/天）
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

# 增删改
npx wrangler d1 execute guestbook --local --command "DELETE FROM users WHERE id = 1"

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

# Turnstile 不支持 localhost，改用 Cloudflare 官方测试密钥（验证码自动通过）
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

在浏览器中访问以下地址，页面会自动检测 API/JS/CSS 是否可用并渲染留言板：

```
http://localhost:8788/test-widget.html
```

> 如需此测试页面，将以下 HTML 保存到 `dist/test-widget.html`：
> ```html
> <!DOCTYPE html>
> <html lang="zh-CN"><head><meta charset="UTF-8"><title>留言板测试</title></head>
> <body style="max-width:800px;margin:40px auto;font-family:sans-serif">
>   <h2>留言板 Widget 测试</h2>
>   <div id="status">检测中...</div><hr>
>   <link rel="stylesheet" href="/widget.css">
>   <script src="/widget.js"></script>
>   <guestbook-widget api-base="/" site-key="1x00000000000000000000AA" page-id="/test"/>
>   <script>
>     Promise.all([
>       fetch('/api/v1/config').then(r=>r.ok),
>       fetch('/widget.js').then(r=>r.ok),
>       fetch('/widget.css').then(r=>r.ok),
>     ]).then(([api,js,css])=>{
>       const el=document.getElementById('status');
>       if(api&&js&&css){el.innerHTML='✅ API: 正常 | JS: 正常 | CSS: 正常';el.style.color='green';}
>       else{el.innerHTML=`❌ API:${api?'OK':'失败'} | JS:${js?'OK':'失败'} | CSS:${css?'OK':'失败'}`;el.style.color='red';}
>     }).catch(()=>{document.getElementById('status').innerHTML='❌ 服务未运行';document.getElementById('status').style.color='red';});
>   </script>
> </body></html>
> ```
> 测试完后删除此文件。

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

# 部署到 Cloudflare Pages
# 方式一：通过 Git 连接 Pages 自动部署
# 方式二：手动部署
wrangler pages deploy dist
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

## Hugo 集成

将 `hugo-templates/` 中的文件复制到你的 Hugo 站点：

```
hugo-templates/
├── layouts/partials/footer/custom.html          → 覆盖 FixIt 主题的 body-end 钩子
├── layouts/partials/post/footer-custom.html     → 文章底部自动嵌入
├── layouts/shortcodes/guestbook.html            → 手动插入短代码
└── config-example.toml                          → 配置参考
```

在 `config.toml` 中添加：

```toml
[params.guestbook]
  enable = true
  apiBase = "https://cf-guestbook.pages.dev/api/v1"
  siteKey = "你的Turnstile Site Key"
  theme = "auto"
  maxLength = 500
```

在文章 Front Matter 中可关闭留言板：

```yaml
guestbook: false
```

或使用短代码手动插入：

```markdown
{{</* guestbook pageId="/about/" */>}}
```

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
| GET | `/api/v1/messages` | 可选 | 留言列表 |
| POST | `/api/v1/messages` | JWT + Turnstile | 提交留言 |
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
├── lib/                  → 共享工具库
├── sql/                  → 数据库脚本
├── src/
│   ├── widget/           → 留言板 Widget（Web Component）
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
- 密码使用 PBKDF2-SHA256（600000 次迭代）加密
- Refresh Token 存储在 HttpOnly Cookie（SameSite=None; Secure）
- 所有用户输入入库前 HTML 转义
- CORS 仅允许配置的域名
- 管理员操作全部记录审计日志

## 许可

MIT
