// src/shared/types.ts — 前端共享类型定义

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  email?: string;        // 仅在自身信息接口（/auth/me, /auth/login 等）中返回
  phone?: string;        // 手机号，管理后台用户列表中返回
  emailVerified?: boolean;  // 仅在自身信息接口中返回
  avatar: string;
  role: string;
  bio?: string;
}

export interface ReplyToMessage {
  id: number;
  username: string;
  displayName: string;
  content: string | null;
  isSecret: boolean;
  status: string;
}

export interface PublicMessage {
  id: number;
  pageId: string;
  pageUrl?: string;
  content: string | null;
  isSecret: boolean;
  status: string;
  replyTo: number | null;
  ipAddress?: string;
  replyToMessage?: ReplyToMessage;
  createdAt: string;
  updatedAt: string | null;
  user: PublicUser;
}

export interface BoardConfig {
  siteName: string;
  minMessageLength: number;
  maxMessageLength: number;
  requireCaptcha: boolean;
  moderationEnabled: boolean;
  dailySecretLimit: number;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
  forceSkipTurnstile: boolean;
  analyticsEnabled: boolean;
  showViewCount: boolean;
  turnstileSiteKey?: string;
}

export interface PageStats {
  pageId: string;
  pageTitle: string;
  pageUrl: string;
  canonicalUrl: string;
  views: number;
  visitors: number;
  sessions: number;
  searchViews: number;
  messageCount: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** 游标分页响应（无 COUNT，高性能） */
export interface CursorPaginatedResponse<T> {
  items: T[];
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ApiError {
  code: number;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Widget 初始化参数
export interface WidgetOptions {
  container: string;
  pageId: string;
  apiBase: string;
  siteKey?: string; // 可选，widget 会从 config API 自动获取
  theme?: 'light' | 'dark' | 'auto';
  maxLength?: number;
  showViewCount?: boolean;
}

// 管理后台统计
export interface AdminStats {
  totalMessages: number;
  todayMessages: number;
  totalUsers: number;
  pendingMessages: number;
  secretMessages: number;
}

export interface AnalyticsSummary {
  today: { views: number; visitors: number; sessions: number };
  yesterday: { views: number; visitors: number; sessions: number };
  windows: { last7Views: number; last30Views: number; previous7Views: number };
  topPages: AnalyticsPage[];
}

export interface AnalyticsPage {
  pageId: string;
  pageTitle: string;
  pageUrl: string;
  canonicalUrl?: string;
  views: number;
  visitors: number;
  sessions: number;
  searchViews: number;
  messageCount: number;
  lastViewAt?: string | null;
  lastMessageAt?: string | null;
  updatedAt?: string;
}

export interface AnalyticsBreakdownRow {
  channel?: string;
  referrerDomain?: string;
  views: number;
  visitors: number;
  sessions?: number;
}

/** 搜索来源分析数据 */
export interface SearchAnalytics {
  engines: AnalyticsBreakdownRow[];
  pages: SearchLandingPage[];
  trend: AnalyticsTrendRow[];
  countries: AnalyticsBreakdownRow[];
}

/** 搜索着陆页 */
export interface SearchLandingPage {
  pageId: string;
  pageTitle: string;
  pageUrl: string;
  views: number;
  visitors: number;
  totalViews: number;   // 该页面总浏览量（用于计算搜索占比）
  topEngines: string[]; // 主要搜索引擎来源（Top 3 域名）
}

/** 流量趋势行 */
export interface AnalyticsTrendRow {
  date: string;
  views: number;
  visitors: number;
}

/** 社交传播分析数据 */
export interface SocialAnalytics {
  sources: SocialSource[];
  pages: SocialPage[];
  trend: AnalyticsTrendRow[];
}

/** 社交平台来源 */
export interface SocialSource {
  platform: string;
  views: number;
  visitors: number;
  domains: string[];
}

/** 社交传播页面 */
export interface SocialPage {
  pageId: string;
  pageTitle: string;
  pageUrl: string;
  socialViews: number;
  socialVisitors: number;
}

// 管理后台配置
export interface AdminConfig {
  siteName: string;
  minMessageLength: number;
  maxMessageLength: number;
  requireCaptcha: boolean;
  moderationEnabled: boolean;
  dailySecretLimit: number;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
  forceSkipTurnstile: boolean;
  analyticsEnabled: boolean;
  showViewCount: boolean;
  updatedAt: string;
}

// 管理员操作日志
export interface AdminLog {
  id: number;
  adminId: number;
  adminUsername: string;
  action: string;
  targetType: string;
  targetId: number | null;
  detail: string;
  ipAddress: string;
  createdAt: string;
}
