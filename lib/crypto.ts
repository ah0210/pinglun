// lib/crypto.ts — PBKDF2 密码哈希（Web Crypto API 内置，零外部依赖）

const ITERATIONS = 600000;
const HASH_ALGO = 'SHA-256';
const SALT_LENGTH = 16;
const KEY_LENGTH = 256;

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: HASH_ALGO },
    keyMaterial,
    KEY_LENGTH
  );
  return `pbkdf2:sha256:${ITERATIONS}:${toBase64(salt.buffer)}:${toBase64(derived)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts[0] !== 'pbkdf2' || parts.length !== 5) return false;
  const iterations = parseInt(parts[2], 10);
  const salt = fromBase64(parts[3]);
  const storedKey = fromBase64(parts[4]);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations, hash: HASH_ALGO },
    keyMaterial,
    KEY_LENGTH
  );
  const derivedBytes = new Uint8Array(derived);

  // 恒定时间比较，防止时序攻击
  if (derivedBytes.length !== storedKey.length) return false;
  let diff = 0;
  for (let i = 0; i < derivedBytes.length; i++) {
    diff |= derivedBytes[i] ^ storedKey[i];
  }
  return diff === 0;
}
