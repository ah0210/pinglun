// lib/response.ts — 统一响应格式 + ErrorCode 错误码

export enum ErrorCode {
  // 认证相关 1xxx
  UNAUTHORIZED = 1001,
  TOKEN_EXPIRED = 1002,
  REFRESH_TOKEN_INVALID = 1003,
  EMAIL_NOT_VERIFIED = 1004,

  // 用户相关 2xxx
  USER_NOT_FOUND = 2001,
  USERNAME_TAKEN = 2002,
  EMAIL_TAKEN = 2003,
  WRONG_PASSWORD = 2004,
  REGISTRATION_DISABLED = 2005,

  // 留言相关 3xxx
  MESSAGE_NOT_FOUND = 3001,
  MESSAGE_TOO_LONG = 3002,
  SECRET_LIMIT_EXCEEDED = 3003,

  // 管理员相关 4xxx
  FORBIDDEN = 4001,

  // 通用 9xxx
  VALIDATION_ERROR = 9001,
  TURNSTILE_FAILED = 9002,
  EMAIL_SEND_FAILED = 9003,
  RATE_LIMITED = 9004,
  SETUP_ALREADY_DONE = 9005,
}

export function errorResponse(code: ErrorCode, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

export function successResponse(data: unknown, headers?: Record<string, string>): Response {
  return Response.json({ success: true, data }, { headers });
}

export function paginatedResponse(
  data: unknown[],
  total: number,
  page: number,
  limit: number,
  headers?: Record<string, string>
): Response {
  return Response.json({
    success: true,
    data: {
      items: data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }, { headers });
}
