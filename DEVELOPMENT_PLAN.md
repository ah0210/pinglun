# 自游人留言板 — 认证系统升级 & 用户设置 开发计划

> 文档版本: v1.3  
> 创建日期: 2026-05-10  
> 最后更新: 2026-05-10  
> 状态: **已开发完成**

---

## 一、需求总览

本次开发涵盖两大模块共 **10 项功能需求**：

### 模块 A：认证系统升级（7 项）

| # | 需求 | 说明 |
|---|------|------|
| A1 | 登录/注册弹窗化 | 点击按钮弹出模态窗口，取代当前内联表单 |
| A2 | 注册确认密码 | 注册时需输入两次密码，确保一致性 |
| A3 | 邮箱验证才能留言 | 注册后收到验证邮件，验证通过后才能发表留言 |
| A4 | 找回密码 | 通过邮箱发送重置密码链接 |
| A5 | 未登录状态 UI | 留言板输入区显示「登录」和「注册」按钮，而非输入框 |
| A6 | 登录后显示输入框 | 登录/注册成功后，按钮区切换为留言输入框 |
| A7 | 全局触发支持 | 页面其他位置可通过简单配置触发登录/注册弹窗 |

### 模块 B：用户设置（3 项）

| # | 需求 | 说明 |
|---|------|------|
| B1 | 用户头像 & 用户名显示 | 登录后留言板右侧显示头像和用户名，点击打开设置 |
| B2 | 用户设置面板 | 修改密码、修改邮箱并重新验证、退出登录 |
| B3 | 邮箱修改与重新验证 | 修改邮箱后状态重置为未验证，需重新验证才能留言 |

### 模块 C：外部页面集成（3 项）

| # | 需求 | 说明 |
|---|------|------|
| C1 | 导航栏认证栏 | 未登录显示登录+注册按钮，登录后显示头像+下拉菜单 |
| C2 | 导航栏下拉菜单 | 显示用户名、邮箱、验证状态、修改密码、修改邮箱、退出 |
| C3 | 全局 JS API | 暴露 `window.GuestBoard` API，支持外部代码触发弹窗、监听状态、挂载认证栏 |

---

## 二、现有系统分析

### 2.1 后端已有能力

| 能力 | API 端点 | 状态 |
|------|---------|------|
| 注册 | `POST /api/v1/auth/register` | ✅ 已实现（含密码强度验证、Turnstile、邮箱验证 token） |
| 登录 | `POST /api/v1/auth/login` | ✅ 已实现 |
| 获取当前用户 | `GET /api/v1/auth/me` | ✅ 已实现，返回含 `emailVerified` 字段 |
| 修改资料 | `PATCH /api/v1/auth/me` | ✅ 已实现（displayName、bio） |
| 修改密码 | `POST /api/v1/auth/change-password` | ✅ 已实现（验证旧密码 + 吊销所有 Refresh Token） |
| 重发验证邮件 | `POST /api/v1/auth/resend-verification` | ✅ 已实现（含 1 分钟频率限制） |
| 邮箱验证确认 | `GET /api/v1/auth/verify-email` | ✅ 已实现 |
| 退出登录 | `POST /api/v1/auth/logout` | ✅ 已实现 |
| Token 刷新 | `POST /api/v1/auth/refresh` | ✅ 已实现 |

### 2.2 后端需新增的 API

| API | 方法 | 说明 |
|-----|------|------|
| `/api/v1/auth/forgot-password` | POST | 请求重置密码邮件（参数：email, turnstileToken），频率限制：邮箱 1 次/分钟，IP 3 次/5分钟，防枚举返回模糊提示 |
| `/api/v1/auth/reset-password` | POST | 通过 token 重置密码（参数：token, newPassword），token 使用后标记为已使用 |
| `/api/v1/auth/change-email` | POST | 修改邮箱（参数：newEmail, currentPassword），重置 email_verified=0，更新 avatar（Gravatar 基于 email），发送验证邮件 |

### 2.3 后端需修改的 API

| API | 方法 | 变更 |
|-----|------|------|
| `/api/v1/auth/verify-email` | GET | 验证成功后返回 HTML 页面（含返回引导），而非纯 JSON |
| `/api/v1/messages` | POST | 增加 `email_verified` 检查（管理员豁免） |

### 2.3 前端当前状态

- **登录/注册**：`LoginForm.vue` 以内联方式嵌入 `GuestBoard.ce.vue`
- **用户栏**：`GuestBoard.ce.vue` 中有简单的 `.gb-user-bar`（头像 + 用户名 + 退出按钮）
- **留言输入**：`MessageForm.vue` 仅在 `auth.user.value` 存在时显示
- **没有**：弹窗组件、用户设置面板、找回密码流程、邮箱验证状态提示

---

## 三、详细设计

### 3.1 弹窗系统（Modal）

**组件结构**：

```
AuthModal.vue     — 认证弹窗（6 种模式，详见下方）
UserDropdown.vue  — 用户下拉菜单（留言板内 + 导航栏共用）
AuthBar.ce.vue    — 导航栏认证栏 Web Component
```

**AuthModal 模式**：

| 模式 | 触发场景 | 表单内容 |
|------|---------|---------|
| `login` | 未登录 → 点击登录 | 用户名/邮箱 + 密码 + Turnstile |
| `register` | 未登录 → 点击注册 | 用户名 + 邮箱 + 密码 + 确认密码 + Turnstile |
| `forgot-password` | 登录弹窗 → 忘记密码 | 邮箱 + Turnstile |
| `reset-password` | 邮件链接 `?reset_token=xxx` | 新密码 + 确认密码 |
| `change-password` | 下拉菜单 → 修改密码 | 当前密码 + 新密码 + 确认新密码 |
| `change-email` | 下拉菜单 → 修改邮箱 / 未验证时修改邮箱 | 新邮箱 + 当前密码 |

**设计要点**：

1. **AuthModal** 使用 `position: fixed` + `z-index: 10000` 覆盖全屏
2. 点击遮罩层关闭（可配置）
3. 弹窗内部复用 `useAuth` composable
4. **两层触发机制**：
   - **CustomEvent**（`gb-open-auth`）：适用于无法获取 GuestBoard 实例的场景（如纯 HTML 按钮），设置 `composed: true` 穿透 Shadow DOM
   - **全局 API**（`window.GuestBoard.openAuth()`）：适用于有 JS 执行能力的场景，功能更完整
   - 两种方式最终效果一致，CustomEvent 是全局 API 的快捷方式

```ts
// 方式一：CustomEvent（纯 HTML 可用）
document.dispatchEvent(new CustomEvent('gb-open-auth', { detail: { mode: 'login' }, composed: true }));

// 方式二：全局 API（推荐，有 JS 能力时优先使用）
GuestBoard.openAuth('login');
```

5. `GuestBoard.ce.vue` 在 `onMounted` 时监听 CustomEvent，打开 `AuthModal`

### 3.2 认证流程变更

#### 注册流程（A2 + A3）

```
用户点击注册 → 弹窗切换到注册模式
  ├─ 填写：用户名、邮箱、密码、确认密码
  ├─ 前端验证：密码一致性、长度、强度
  ├─ 提交注册 → 后端创建用户 + 发送验证邮件 + 返回 accessToken
  ├─ 注册成功 → 自动登录（user 状态已填充）→ 关闭弹窗
  ├─ 用户此时为"已登录但邮箱未验证"状态，留言板显示验证提示
  └─ 用户点击邮件链接 → 邮箱验证完成 → 可正常留言
```

> **注意**：现有 `register.ts` 已返回 accessToken，注册即自动登录。无需额外登录步骤。

**留言发表拦截逻辑**：
- 前端：`MessageForm` 检查 `auth.user.value.emailVerified`，未验证时显示提示 + "重发验证邮件"按钮 + "修改邮箱"按钮
- 后端：`POST /messages` 中间件增加 `email_verified` 检查，未验证返回 `EMAIL_NOT_VERIFIED` 错误
- **管理员豁免**：管理员（`role === 'admin'`）无需验证邮箱即可留言，前后端均跳过检查

#### 找回密码流程（A4）

```
用户点击"忘记密码" → 弹窗切换到找回密码模式
  ├─ 填写邮箱 + Turnstile
  ├─ 提交 → 后端生成 reset token + 发送重置邮件
  │   （频率限制：同一邮箱 1 分钟 1 次，同一 IP 5 分钟 3 次，防邮件轰炸）
  │   （安全策略：无论邮箱是否存在，均返回"如果该邮箱已注册，您将收到重置邮件"，防邮箱枚举）
  └─ 用户点击邮件链接 → URL 带 ?reset_token=xxx → AuthModal 自动以 reset-password 模式打开
      ├─ 填写新密码 + 确认密码
      └─ 提交 → 后端验证 token + 更新密码 + 标记 token 已使用
```

**新增数据表**：`password_resets`

```sql
CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used       INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_password_resets_hash ON password_resets(token_hash);
```

#### 修改邮箱流程（B3）

```
用户点击"修改邮箱"（来源：下拉菜单 / 邮箱未验证提示区）
  ├─ 填写新邮箱 + 当前密码（安全验证）
  ├─ 提交 → 后端验证密码 → 更新 email + email_verified=0 + 更新 avatar（Gravatar 基于 email）→ 发送验证邮件
  ├─ 前端刷新 user 状态（新邮箱 + 新头像 + emailVerified=false）
  └─ 用户收到验证邮件 → 验证完成 → email_verified=1
```

### 3.3 用户设置 — 下拉菜单 + 弹窗（B1 + B2）

**触发方式**：点击用户栏头像/用户名，弹出下拉菜单

> 留言板内和导航栏共用同一下拉菜单组件，交互完全一致。

**下拉菜单**：

```
  [头像] 用户名 ▼
  ┌──────────────────────────┐
  │  👤 用户名               │
  │  📧 user@email.com       │
  │  ✅ 邮箱已验证            │
  │  ──────────────────      │
  │  🔒 修改密码              │
  │  📧 修改邮箱              │
  │  🚪 退出登录              │
  └──────────────────────────┘
```

**菜单项操作**：

| 菜单项 | 操作 | UI 形式 |
|--------|------|---------|
| 修改密码 | 打开修改密码弹窗 | AuthModal（change-password 模式） |
| 修改邮箱 | 打开修改邮箱弹窗 | AuthModal（change-email 模式） |
| 退出登录 | 直接执行退出 | 无需弹窗 |

### 3.4 前端状态与 UI 变更

#### 未登录状态（A5）

```
┌─────────────────────────────────────┐
│  留言板                              │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  登录后即可留言              │    │
│  │  [登录]  [注册]             │    │
│  └─────────────────────────────┘    │
│                                     │
│  --- 留言列表 ---                    │
└─────────────────────────────────────┘
```

点击「登录」/「注册」→ 弹出 `AuthModal`

#### 已登录但邮箱未验证

```
┌─────────────────────────────────────────────────┐
│  留言板                    [头像] 用户名 ▼      │
│                                                 │
│  ⚠️ 请先验证邮箱才能留言                         │
│  📧 当前邮箱：u***@example.com                  │
│  [重发验证邮件]  [修改邮箱]                      │
│                                                 │
│  --- 留言列表 ---                                │
└─────────────────────────────────────────────────┘
```

点击「修改邮箱」→ 弹出修改邮箱弹窗（输入新邮箱 + 当前密码），修改成功后自动发送验证邮件，邮箱验证状态刷新为未验证，提示用户验证新邮箱。

#### 已登录且已验证

```
┌─────────────────────────────────────┐
│  留言板          [头像] 用户名 ▼     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  写下你的留言...             │    │
│  │  [发送留言]                  │    │
│  └─────────────────────────────┘    │
│                                     │
│  --- 留言列表 ---                    │
└─────────────────────────────────────┘
```

---

### 3.5 外部页面集成（模块 C）

#### 核心问题

留言板是 Web Component（Shadow DOM 隔离），但用户需要在网站导航栏（Shadow DOM 外部）展示认证状态和操作入口。需要一种机制让外部页面与留言板的认证系统交互。

#### 方案：全局 JS API + mountAuthBar 辅助方法

Widget 初始化后暴露 `window.GuestBoard` 全局对象，提供三种集成方式：

**API 定义**：

```ts
interface GuestBoardAPI {
  // 获取当前用户状态
  getUser(): PublicUser | null;

  // 打开认证弹窗
  openAuth(mode: 'login' | 'register' | 'forgot-password' | 'reset-password'): void;

  // 打开用户设置弹窗
  openSettings(): void;

  // 退出登录
  logout(): Promise<void>;

  // 监听认证状态变化，返回取消监听函数
  onAuthChange(callback: (user: PublicUser | null) => void): () => void;

  // 挂载认证栏到指定容器（自动渲染，自动更新）
  mountAuthBar(containerOrSelector: HTMLElement | string, options?: AuthBarOptions): void;

  // 卸载认证栏
  unmountAuthBar(): void;
}

interface AuthBarOptions {
  showEmail?: boolean;        // 是否在下拉菜单显示邮箱，默认 true
  showVerifiedStatus?: boolean; // 是否显示验证状态，默认 true
  avatarSize?: number;         // 头像大小，默认 32
}
```

#### 集成方式一：mountAuthBar（推荐，最省事）

Widget 自动在指定容器内渲染完整的认证栏 UI，自动响应登录/退出状态。

```html
<!-- 网站导航栏 -->
<nav>
  <div class="nav-brand">自游人</div>
  <div id="gb-auth-bar"></div>  <!-- 认证栏挂载点 -->
</nav>

<!-- 留言板 -->
<div id="guestbook"></div>

<script>
  const gb = new GuestBoard({
    container: '#guestbook',
    pageId: 'home',
    apiBase: 'https://your-domain.com/api/v1'
  });

  // 自动渲染认证栏到导航栏
  gb.mountAuthBar('#gb-auth-bar');
</script>
```

#### 集成方式二：onAuthChange（自定义 UI）

外部页面自己控制 UI，仅监听状态变化。

```js
gb.onAuthChange((user) => {
  const authBar = document.getElementById('gb-auth-bar');
  if (user) {
    authBar.innerHTML = `
      <img src="${user.avatar}" class="nav-avatar" />
      <span>${user.displayName}</span>
    `;
  } else {
    authBar.innerHTML = `
      <button onclick="gb.openAuth('login')">登录</button>
      <button onclick="gb.openAuth('register')">注册</button>
    `;
  }
});
```

#### 集成方式三：纯触发（最轻量）

外部页面已有自己的 UI，只需调用弹窗。

```html
<button onclick="GuestBoard.openAuth('login')">登录</button>
<button onclick="GuestBoard.openAuth('register')">注册</button>
```

#### 导航栏下拉菜单（已登录状态）

`mountAuthBar` 渲染的已登录 UI：

```
┌──────────────────────────────────────────┐
│  自游人     [头像] 用户名           ▼    │  ← 网站导航栏
│             ┌──────────────────────────┐ │
│             │  👤 用户名               │ │
│             │  📧 user@email.com       │ │
│             │  ✅ 邮箱已验证           │ │
│             │  ────────────────────    │ │
│             │  🔒 修改密码             │ │
│             │  📧 修改邮箱             │ │
│             │  🚪 退出登录             │ │
│             └──────────────────────────┘ │
└──────────────────────────────────────────┘
```

- 点击「修改密码」→ 弹出修改密码弹窗（复用 AuthModal）
- 点击「修改邮箱」→ 弹出修改邮箱弹窗（复用 AuthModal）
- 点击「退出」→ 退出登录 → 下拉菜单消失，头像切换回「登录」「注册」按钮

#### 技术实现要点

1. **AuthBar 组件**：创建独立的 `AuthBar.ce.vue`（也是 Web Component），挂载到用户指定的外部容器
2. **状态同步**：AuthBar 与 GuestBoard 共享 `useAuth` 的响应式状态（`user` ref 是模块级单例）
3. **弹窗定位**：AuthBar 中的弹窗（修改密码/修改邮箱）使用 `position: fixed` + 高 `z-index`，确保在导航栏上方正常显示
4. **Shadow DOM 样式隔离**：AuthBar 作为独立 Web Component，样式与页面和留言板均隔离，互不干扰
5. **邮箱未验证提示**：导航栏下拉菜单中，邮箱未验证时显示 ⚠️ 并提供快捷操作

---

## 四、待决策事项

### 决策 1：用户设置面板的展现形式（留言板内）

留言板内和导航栏的用户操作入口应保持一致：点击头像/用户名 → 下拉菜单，菜单项点击后弹出对应弹窗。

**统一后的交互**：

```
点击头像/用户名
  → 下拉菜单（用户名、邮箱、验证状态、修改密码、修改邮箱、退出）
    → 修改密码 → 弹出修改密码弹窗
    → 修改邮箱 → 弹出修改邮箱弹窗
    → 退出     → 直接退出
```

留言板内（GuestBoard）和导航栏（AuthBar）共用同一下拉菜单组件，区别仅在于定位锚点不同（留言板内锚定用户栏，导航栏锚定头像），表单操作统一由 AuthModal 弹窗承载。

**结论：下拉菜单（Dropdown），与导航栏一致。**

### 决策 2：密码重置页面的承载方式

| 选项 | 优点 | 缺点 |
|------|------|------|
| **A. 独立页面** | URL 可分享，体验清晰 | 需要独立路由，部署在 Workers 上需额外处理 |
| **B. 弹窗内完成** | 全部在组件内闭环，无需路由 | 弹窗需要识别 URL 中的 reset token 参数 |

**建议**：选项 B。在 `AuthModal` 中增加 `reset-password` 模式，通过 URL 参数 `?reset_token=xxx` 自动打开。

### 决策 3：邮箱验证拦截留言的粒度

| 选项 | 说明 |
|------|------|
| **A. 仅前端拦截** | 前端不显示输入框，后端不强制检查 |
| **B. 前后端双重拦截** | 前端不显示输入框 + 后端返回 EMAIL_NOT_VERIFIED |

**建议**：选项 B。前后端双重保障更安全，防止绕过前端直接调用 API。

### 决策 4：修改邮箱后是否强制重新验证才能继续使用

| 选项 | 说明 |
|------|------|
| **A. 修改邮箱后仅限制留言** | 已有留言正常显示，只是不能再发新留言 |
| **B. 修改邮箱后完全冻结** | 账号进入"待验证"状态，所有操作受限 |

**建议**：选项 A。仅限制留言功能，已有留言不受影响，用户体验更友好。

### 决策 5：导航栏认证栏的实现方式

| 选项 | 优点 | 缺点 |
|------|------|------|
| **A. Web Component（`<gb-auth-bar>`）** | 样式完全隔离，与留言板共享状态 | 用户需在导航栏放一个 HTML 标签 |
| **B. mountAuthBar 注入普通 DOM** | API 调用即挂载，无需额外标签 | 样式可能与宿主页面冲突 |
| **C. 纯事件驱动，用户自行渲染** | 最灵活，无样式冲突风险 | 用户需自行实现 UI |

**建议**：选项 A（独立 Web Component `<gb-auth-bar>`）。用户在导航栏放一个 `<gb-auth-bar api-base="...">` 标签，Widget 自动初始化并渲染。样式隔离，状态通过模块级单例 `useAuth` 共享，交互最流畅。

---

## 五、开发步骤

### 阶段 1：后端 API 扩展

| 步骤 | 内容 | 涉及文件 |
|------|------|---------|
| 1.1 | 新增 `password_resets` 表迁移 SQL | `sql/004_password_resets.sql` |
| 1.2 | 实现 `POST /auth/forgot-password` | `functions/api/v1/auth/forgot-password.ts` |
| 1.3 | 实现 `POST /auth/reset-password` | `functions/api/v1/auth/reset-password.ts` |
| 1.4 | 实现 `POST /auth/change-email` | `functions/api/v1/auth/change-email.ts` |
| 1.5 | 修改发帖 API，增加邮箱验证检查 | `functions/api/v1/messages/index.ts` |
| 1.6 | `PublicUser` 类型增加 `emailVerified` 字段 | `lib/types.ts` |
| 1.7 | `ErrorCode` 增加新错误码 | `lib/response.ts` |
| 1.8 | `lib/email.ts` 增加重置密码邮件模板 | `lib/email.ts` |

### 阶段 2：前端弹窗系统

| 步骤 | 内容 | 涉及文件 |
|------|------|---------|
| 2.1 | 创建 `AuthModal.vue` 组件 | `src/widget/components/AuthModal.vue` |
| 2.2 | 实现登录模式（从 `LoginForm.vue` 迁移） | `AuthModal.vue` |
| 2.3 | 实现注册模式（增加确认密码字段） | `AuthModal.vue` |
| 2.4 | 实现找回密码模式 | `AuthModal.vue` |
| 2.5 | 实现重置密码模式（识别 URL token） | `AuthModal.vue` |
| 2.6 | `useAuth` 增加 `forgotPassword`、`resetPassword`、`changeEmail` 方法 | `src/widget/composables/useAuth.ts` |
| 2.7 | `GuestBoard.ce.vue` 监听 `gb-open-auth` 自定义事件 | `src/widget/components/GuestBoard.ce.vue` |
| 2.8 | 弹窗样式（遮罩、动画、响应式） | `GuestBoard.ce.vue` style 块 |

### 阶段 3：前端 UI 重构

| 步骤 | 内容 | 涉及文件 |
|------|------|---------|
| 3.1 | 重构用户栏：头像 + 用户名可点击 | `GuestBoard.ce.vue` |
| 3.2 | 未登录状态：显示登录/注册按钮 | `GuestBoard.ce.vue` |
| 3.3 | 邮箱未验证状态：显示提示 + 重发按钮 + 修改邮箱按钮 | `GuestBoard.ce.vue` / 新组件 |
| 3.4 | 删除 `LoginForm.vue` 的内联引用（改用弹窗） | `GuestBoard.ce.vue` |
| 3.5 | 删除 `LoginForm.vue`，登录/注册逻辑已在 AuthModal 中完整实现 | `src/widget/components/LoginForm.vue` |

### 阶段 4：用户下拉菜单（留言板内 + 导航栏共用）

> 留言板内和导航栏共用同一个 `UserDropdown.vue` 组件，交互完全一致。

| 步骤 | 内容 | 涉及文件 |
|------|------|---------|
| 4.1 | 创建 `UserDropdown.vue` 下拉菜单组件 | `src/widget/components/UserDropdown.vue` |
| 4.2 | 菜单内容：用户名、邮箱、验证状态、修改密码、修改邮箱、退出 | `UserDropdown.vue` |
| 4.3 | 点击修改密码 → 触发 AuthModal 弹窗（change-password 模式） | `UserDropdown.vue` |
| 4.4 | 点击修改邮箱 → 触发 AuthModal 弹窗（change-email 模式） | `UserDropdown.vue` |
| 4.5 | 点击退出 → 执行退出登录 | `UserDropdown.vue` |
| 4.6 | 留言板 `GuestBoard.ce.vue` 集成 UserDropdown | `GuestBoard.ce.vue` |
| 4.7 | 下拉菜单样式（定位、动画、响应式） | `GuestBoard.ce.vue` style 块 |

### 阶段 5：外部页面集成（模块 C）

| 步骤 | 内容 | 涉及文件 |
|------|------|---------|
| 5.1 | 创建 `AuthBar.ce.vue` 独立 Web Component | `src/widget/components/AuthBar.ce.vue` |
| 5.2 | 实现未登录状态：登录 + 注册按钮 | `AuthBar.ce.vue` |
| 5.3 | 实现已登录状态：头像 + 复用 UserDropdown | `AuthBar.ce.vue` |
| 5.4 | 修改密码/修改邮箱点击后弹出弹窗（复用 AuthModal） | `AuthBar.ce.vue` |
| 5.5 | 退出登录后头像切换回登录/注册按钮 | `AuthBar.ce.vue` |
| 5.6 | 暴露 `window.GuestBoard` 全局 API | `src/widget/index.ts` |
| 5.7 | AuthBar 样式（导航栏适配） | `AuthBar.ce.vue` |
| 5.8 | 构建配置：AuthBar 独立打包 | `vite.widget.config.ts` |

---

## 六、文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `sql/004_password_resets.sql` | 密码重置表迁移 |
| `functions/api/v1/auth/forgot-password.ts` | 忘记密码 API |
| `functions/api/v1/auth/reset-password.ts` | 重置密码 API |
| `functions/api/v1/auth/change-email.ts` | 修改邮箱 API |
| `src/widget/components/AuthModal.vue` | 认证弹窗组件（6 种模式） |
| `src/widget/components/UserDropdown.vue` | 用户下拉菜单组件（留言板内 + 导航栏共用） |
| `src/widget/components/AuthBar.ce.vue` | 导航栏认证栏 Web Component |

### 删除文件

| 文件 | 说明 |
|------|------|
| `src/widget/components/LoginForm.vue` | 登录/注册逻辑已迁移到 AuthModal |

### 修改文件

| 文件 | 变更内容 |
|------|---------|
| `lib/types.ts` | `PublicUser` 增加 `emailVerified`; `toPublicUser` 增加字段映射 |
| `lib/response.ts` | `ErrorCode` 增加 `PASSWORD_RESET_EXPIRED`, `EMAIL_CHANGE_FAILED` 等 |
| `lib/email.ts` | 增加 `buildResetPasswordHtml` 模板 |
| `src/shared/types.ts` | `PublicUser` 增加 `emailVerified` |
| `src/widget/composables/useAuth.ts` | 增加 `forgotPassword`, `resetPassword`, `changeEmail` 方法；状态改为模块级单例供多组件共享 |
| `src/widget/components/GuestBoard.ce.vue` | 重构用户栏 + 集成弹窗/设置面板 + 事件监听 + 邮箱未验证修改入口 |
| `src/widget/index.ts` | 暴露 `window.GuestBoard` 全局 API（`openAuth`, `openSettings`, `logout`, `onAuthChange`, `mountAuthBar`） |
| `functions/api/v1/messages/index.ts` | POST 增加邮箱验证检查 |
| `vite.widget.config.ts` | 增加 AuthBar 独立打包入口 |

---

## 七、风险与注意事项

1. **Shadow DOM 事件隔离**：`CustomEvent` 需设置 `composed: true` 才能穿透 Shadow DOM 边界
2. **密码重置 token 安全**：与 email_verifications 一致，存储 hash 而非明文 token
3. **修改邮箱竞态**：修改邮箱后旧验证链接应失效（通过 user_id 关联，旧 token 属于旧邮箱记录）
4. **弹窗与 Turnstile**：Shadow DOM 内无法直接使用 Turnstile，当前已在 document.body 创建容器，弹窗中需同样处理
5. **邮箱验证状态同步**：前端 `auth.user.value.emailVerified` 需在验证完成后刷新，可通过验证成功页回调或定期轮询 `/auth/me`
6. **修改密码后强制重登录**：后端已实现吊销 Refresh Token，前端需配合清理 access token + 清空 user 状态
7. **邮箱验证确认页 UX**：当前 `verify-email` 端点返回 JSON，用户点击邮件链接后看到原始 JSON 体验差。需改为：验证成功后返回 HTML 页面，包含"验证成功，返回留言板"引导链接，或重定向到宿主页面并触发刷新
8. **forgot-password 防枚举**：无论邮箱是否存在，统一返回模糊提示（"如果该邮箱已注册，您将收到重置邮件"），避免攻击者枚举注册邮箱
9. **forgot-password 频率限制**：后端需同时限制邮箱维度（1 分钟 1 次）和 IP 维度（5 分钟 3 次），防止邮件轰炸
10. **LoginForm.vue 去留**：`AuthModal` 将完整实现登录/注册表单，`LoginForm.vue` 将废弃并删除

---

## 八、讨论记录

### 2026-05-10 第一轮讨论

1. **回复功能**（已实现）：一级回复，`reply_to` 指向被回复留言，扁平列表 + 引用块展示，内联回复表单
2. **认证系统升级**：7 项需求确认（弹窗化、确认密码、邮箱验证、找回密码、未登录 UI、登录后输入框、全局触发）
3. **用户设置功能**：
   - 用户栏显示头像 + 用户名，点击打开设置
   - 设置面板支持修改密码、修改邮箱（含重新验证）、退出登录
   - 修改邮箱后 `email_verified` 重置为 0，需重新验证才能留言

### 2026-05-10 第三轮讨论（文档审查优化）

1. **组件结构统一**：`UserSettings.vue` → `UserDropdown.vue`，留言板内和导航栏共用下拉菜单
2. **AuthModal 模式补全**：从 3 种扩展到 6 种（login / register / forgot-password / reset-password / change-password / change-email）
3. **注册后状态明确**：现有 register API 返回 accessToken，注册即自动登录，用户处于"已登录但未验证"状态
4. **forgot-password 安全**：增加防枚举（模糊提示）+ 频率限制（邮箱维度 + IP 维度）
5. **change-email 联动**：邮箱变更后同步更新 Gravatar 头像
6. **管理员邮箱验证豁免**：管理员无需验证邮箱即可留言
7. **verify-email UX**：验证成功后返回 HTML 页面而非 JSON
8. **LoginForm.vue 废弃**：合并到 AuthModal，删除原文件
9. **CustomEvent vs 全局 API**：两者关系明确，CustomEvent 是全局 API 的快捷方式

### 2026-05-10 第二轮讨论

1. **邮箱未验证状态增加修改邮箱入口**：
   - 用户注册时可能随意填写邮箱，发现无法留言后需要修改为真实邮箱
   - 邮箱未验证提示区增加「修改邮箱」按钮，点击弹出修改邮箱弹窗
   - 显示当前邮箱（脱敏：`u***@example.com`）

2. **外部页面集成方案（模块 C 新增）**：
   - 网站导航栏需展示认证状态：未登录 → 登录+注册按钮，已登录 → 头像+下拉菜单
   - 下拉菜单内容：用户名、邮箱、验证状态、修改密码、修改邮箱、退出登录
   - 点击修改密码/修改邮箱弹出弹窗，退出后头像切换回按钮
   - 方案：暴露 `window.GuestBoard` 全局 API + 独立 `AuthBar.ce.vue` Web Component
   - 三种集成方式：mountAuthBar（推荐）、onAuthChange（自定义 UI）、纯触发（最轻量）

### 待确认

- [x] 决策 1：用户设置面板形式 → **下拉菜单（Dropdown），与导航栏一致**
- [x] 决策 2：密码重置页面承载方式 → **弹窗内完成（B）**
- [x] 决策 3：邮箱验证拦截粒度 → **前后端双重拦截（B）**
- [x] 决策 4：修改邮箱后是否完全冻结账号 → **仅限制留言（A）**
- [x] 决策 5：导航栏认证栏实现方式 → **Web Component `<gb-auth-bar>`（A）**

---

## 九、开发记录

### 2026-05-10 开发实施

#### 安全审查发现并修复的 Bug

1. **`resend-verification.ts` token 存储不一致**：注册时用 `hashToken()` 存储，但重发时用明文存储，导致重发的验证链接无法通过验证。已修复为统一 hash 存储。

#### 实际开发变更

**后端新增文件**：
- `sql/004_password_resets.sql` — 密码重置表（含 `ip_address` 字段，token hash 存储）
- `functions/api/v1/auth/forgot-password.ts` — 忘记密码 API（双维度频率限制、防枚举）
- `functions/api/v1/auth/reset-password.ts` — 重置密码 API（token 验证、密码强度校验、吊销 Refresh Token）
- `functions/api/v1/auth/change-email.ts` — 修改邮箱 API（密码验证、Gravatar 头像更新、发送验证邮件）

**后端修改文件**：
- `lib/types.ts` — `PublicUser` 增加 `email`、`emailVerified`；`toPublicUser` 增加字段映射
- `lib/response.ts` — `ErrorCode` 增加 `PASSWORD_RESET_EXPIRED`、`PASSWORD_RESET_USED`、`PASSWORD_RESET_INVALID`
- `lib/email.ts` — 增加 `buildResetPasswordHtml` 模板
- `functions/api/v1/auth/verify-email.ts` — 改为返回 HTML 页面（验证成功/过期/已验证三种状态页）
- `functions/api/v1/auth/resend-verification.ts` — 修复 token hash 存储不一致 bug
- `functions/api/v1/auth/register.ts` — 返回数据增加 `emailVerified` 字段
- `functions/api/v1/auth/me.ts` — PATCH 返回增加 `emailVerified`
- `functions/api/v1/messages/index.ts` — POST 增加邮箱验证检查（管理员豁免）；GET 列表 PublicUser 增加新字段

**前端新增文件**：
- `src/widget/components/AuthModal.vue` — 认证弹窗（6 种模式）
- `src/widget/components/UserDropdown.vue` — 用户下拉菜单（留言板 + 导航栏共用）
- `src/widget/components/AuthBar.ce.vue` — 导航栏认证栏 Web Component

**前端修改文件**：
- `src/widget/composables/useAuth.ts` — 重构为模块级单例，新增 `forgotPassword`、`resetPassword`、`changePassword`、`changeEmail`、`resendVerification` 方法
- `src/widget/components/GuestBoard.ce.vue` — 集成 AuthModal + UserDropdown + 邮箱未验证提示，移除 LoginForm
- `src/widget/entry.ts` — 注册 `gb-auth-bar` Web Component，暴露 `window.GuestBoard` 全局 API
- `src/shared/types.ts` — `PublicUser` 增加 `email`、`emailVerified`（必填）
- `vite.widget.config.ts` — 更新构建配置

**前端删除文件**：
- `src/widget/components/LoginForm.vue` — 功能已迁移到 AuthModal
