// ===== 环境变量类型 =====
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  EMAIL_DOMAIN: string;
  EMAIL_FROM_NAME: string;
  TURNSTILE_SECRET_KEY: string;
  PUBLIC_URL: string;
  SITE_NAME: string;
  ALLOWED_ORIGINS: string;
  TURNSTILE_SITE_KEY?: string;
  ADMIN_USERNAME?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
}

// ===== 数据库行类型 =====
export interface DbUser {
  id: number;
  username: string;
  display_name: string;
  email: string;
  email_verified: number;
  password_hash: string;
  role: string;
  avatar: string;
  bio: string;
  vip_level: number;
  vip_expires_at: string | null;
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: number;
  user_id: number;
  page_id: string;
  content: string;
  is_secret: number;
  status: string;
  reply_to: number | null;
  created_at: string;
  updated_at: string | null;
}

export interface DbVerification {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  verified: number;
  created_at: string;
}

export interface DbRefreshToken {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
}

export interface DbBoardConfig {
  id: number;
  site_name: string;
  min_message_length: number;
  max_message_length: number;
  require_captcha: number;
  moderation_enabled: number;
  daily_secret_limit: number;
  allow_registration: number;
  updated_at: string;
}

export interface DbAdminLog {
  id: number;
  admin_id: number;
  action: string;
  target_type: string;
  target_id: number | null;
  detail: string;
  ip_address: string;
  created_at: string;
}

// ===== API 响应类型 =====
export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  email?: string;
  emailVerified?: boolean;
  avatar: string;
  role: string;
  bio: string;
}

export interface ReplyToMessage {
  id: number;
  username: string;
  content: string;
  isSecret: boolean;
}

export interface PublicMessage {
  id: number;
  pageId: string;
  content: string;
  isSecret: boolean;
  status: string;
  replyTo: number | null;
  replyToMessage?: ReplyToMessage;
  createdAt: string;
  updatedAt: string | null;
  user: PublicUser;
}

// ===== JWT =====
export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

// ===== 请求体类型 =====
export interface RegisterBody {
  username: string;
  email: string;
  password: string;
  turnstileToken: string;
}

export interface LoginBody {
  login: string;
  password: string;
  turnstileToken: string;
}

export interface PostMessageBody {
  content: string;
  pageId: string;
  isSecret?: boolean;
  turnstileToken?: string;
}

export interface UpdateProfileBody {
  displayName?: string;
  bio?: string;
}

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export interface SetupBody {
  username: string;
  email: string;
  password: string;
}

// ===== 工具类型 =====
export type PagesFunctionEnv = PagesFunction<Env>;

export function toPublicUser(u: DbUser): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name || u.username,
    email: u.email,
    emailVerified: u.email_verified === 1,
    avatar: u.avatar,
    role: u.role,
    bio: u.bio,
  };
}

export function toPublicMessage(m: DbMessage, u: PublicUser): PublicMessage {
  return {
    id: m.id,
    pageId: m.page_id,
    content: m.content,
    isSecret: m.is_secret === 1,
    status: m.status,
    replyTo: m.reply_to,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    user: u,
  };
}
