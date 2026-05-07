// lib/jwt.ts — JWT 签发与验证（Web Crypto API HMAC-SHA256）

import type { Env, JwtPayload } from './types';

const ACCESS_TOKEN_EXPIRY = 15 * 60;           // 15 分钟
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 3600;    // 7 天

function base64UrlEncode(data: ArrayBuffer | string): string {
  const str = typeof data === 'string'
    ? btoa(unescape(encodeURIComponent(data)))
    : btoa(String.fromCharCode(...new Uint8Array(data)));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signAccessToken(payload: { userId: number; username: string; role: string }, env: Env): Promise<string> {
  const key = await getSigningKey(env.JWT_SECRET);
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload: JwtPayload = { ...payload, iat: now, exp: now + ACCESS_TOKEN_EXPIRY };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(jwtPayload));
  const signatureInput = `${header}.${body}`;

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureInput));
  const signature = base64UrlEncode(sig);

  return `${signatureInput}.${signature}`;
}

export async function verifyAccessToken(token: string, env: Env): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const key = await getSigningKey(env.JWT_SECRET);

    const sigValid = await crypto.subtle.verify(
      'HMAC',
      key,
      Uint8Array.from(base64UrlDecode(signature), c => c.charCodeAt(0)),
      new TextEncoder().encode(`${header}.${body}`)
    );
    if (!sigValid) return null;

    const payload: JwtPayload = JSON.parse(decodeURIComponent(escape(base64UrlDecode(body))));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

export function getRefreshTokenExpiry(): number {
  return REFRESH_TOKEN_EXPIRY;
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
