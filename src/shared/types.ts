// src/shared/types.ts — 前端共享类型定义

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  email?: string;        // 仅在自身信息接口（/auth/me, /auth/login 等）中返回
  emailVerified?: boolean;  // 仅在自身信息接口中返回
  avatar: string;
  role: string;
  bio?: string;
}

export interface ReplyToMessage {
  id: number;
  username: string;
  displayName: string;
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

export interface BoardConfig {
  siteName: string;
  minMessageLength: number;
  maxMessageLength: number;
  requireCaptcha: boolean;
  moderationEnabled: boolean;
  dailySecretLimit: number;
  allowRegistration: boolean;
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
}

// 管理后台统计
export interface AdminStats {
  totalMessages: number;
  todayMessages: number;
  totalUsers: number;
  pendingMessages: number;
  secretMessages: number;
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
