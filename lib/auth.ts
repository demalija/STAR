import { createHash, createHmac, randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'asteria_admin_session';
export const SESSION_SECONDS = 8 * 60 * 60;
const HASH_PREFIX = 'scrypt:16384:8:1';
const noStore = { 'Cache-Control': 'no-store, private' };
export type AdminSession = { email: string };
type Configuration = AdminSession & { passwordHash: string; secret: string; fingerprint: string };

function validHash(value: string) {
  return /^scrypt:16384:8:1:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]{86}$/.test(value);
}
function configuration(): Configuration | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || '';
  const secret = process.env.AUTH_SECRET || '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !validHash(passwordHash) || Buffer.byteLength(secret) < 32) return null;
  const fingerprint = createHash('sha256').update(`${email}\0${passwordHash}`).digest('base64url');
  return { email, passwordHash, secret, fingerprint };
}
export function isAdminConfigured(): boolean { return configuration() !== null; }

async function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    derive(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
  });
}
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 1024) throw new Error('Use an admin password between 12 and 1,024 characters.');
  const salt = randomBytes(16);
  return `${HASH_PREFIX}:${salt.toString('base64url')}:${(await scrypt(password, salt)).toString('base64url')}`;
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (typeof password !== 'string' || password.length > 1024 || !validHash(hash)) return false;
  const parts = hash.split(':');
  const actual = await scrypt(password, Buffer.from(parts[4], 'base64url'));
  const expected = Buffer.from(parts[5], 'base64url');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function apiError(message: string, status: number, extra: Record<string, string> = {}): Response {
  return Response.json({ error: message }, { status, headers: { ...noStore, ...extra } });
}
export function applicationOrigin(request: Request): string {
  try {
    const url = new URL(process.env.APP_URL || request.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
    return url.origin;
  } catch { throw apiError('Set APP_URL to your website’s valid http or https address.', 503); }
}
/** Unsafe browser requests require the canonical website origin, including its protocol and port. */
export function checkRequestOrigin(request: Request): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) return;
  const expected = applicationOrigin(request);
  const origin = request.headers.get('origin');
  if (!origin || origin !== expected || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw apiError('This action must be submitted from your own website.', 403);
  }
}
function readCookie(request: Request): string | null {
  const item = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(`${ADMIN_COOKIE}=`));
  return item ? item.slice(ADMIN_COOKIE.length + 1) : null;
}
export function createSessionToken(now = Date.now()): string {
  const config = configuration();
  if (!config) throw apiError('Admin access is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD_HASH, and AUTH_SECRET on the server.', 503);
  const issued = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ v: 1, sub: config.email, aud: 'asteria-admin', iat: issued, exp: issued + SESSION_SECONDS, credential: config.fingerprint })).toString('base64url');
  const signature = createHmac('sha256', config.secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
export function verifySessionToken(token: string | null | undefined, now = Date.now()): AdminSession | null {
  const config = configuration();
  if (!token || token.length > 2048 || !config) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  const expected = createHmac('sha256', config.secret).update(parts[0]).digest();
  const signature = Buffer.from(parts[1], 'base64url');
  if (expected.length !== signature.length || !timingSafeEqual(expected, signature)) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const seconds = Math.floor(now / 1000);
    if (data.v !== 1 || data.aud !== 'asteria-admin' || data.sub !== config.email || data.credential !== config.fingerprint ||
        !Number.isInteger(data.iat) || !Number.isInteger(data.exp) || data.iat > seconds + 60 || data.exp <= seconds ||
        data.exp <= data.iat || data.exp - data.iat > SESSION_SECONDS) return null;
    return { email: config.email };
  } catch { return null; }
}
export async function requireAdmin(request: Request): Promise<AdminSession> {
  if (!configuration()) throw apiError('Admin access is not configured on this server.', 503);
  const session = verifySessionToken(readCookie(request));
  if (!session) throw apiError('Please sign in to manage your website.', 401);
  checkRequestOrigin(request);
  return session;
}
export async function getAdminSession(): Promise<AdminSession | null> {
  const { cookies } = await import('next/headers');
  return verifySessionToken((await cookies()).get(ADMIN_COOKIE)?.value);
}
export function sessionCookie(request: Request, token: string | null): string {
  const secure = applicationOrigin(request).startsWith('https:');
  return `${ADMIN_COOKIE}=${token || ''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? SESSION_SECONDS : 0}${secure ? '; Secure' : ''}`;
}

// A bounded single-owner gate. Use host/edge distributed limiting for multiple app instances.
const globalAuth = globalThis as typeof globalThis & { asteriaLoginGate?: { attempts: number; resetAt: number } };
const LIMIT_WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
async function readLoginBody(request: Request): Promise<string> {
  if (Number(request.headers.get('content-length')) > 4096) throw apiError('Sign-in request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw apiError('Sign-in request is too large.', 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}
export async function loginAdmin(request: Request): Promise<Response> {
  try {
    checkRequestOrigin(request);
    const config = configuration();
    if (!config) throw apiError('Admin access is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD_HASH, and AUTH_SECRET on the server.', 503);
    const now = Date.now();
    if (!globalAuth.asteriaLoginGate || globalAuth.asteriaLoginGate.resetAt <= now) globalAuth.asteriaLoginGate = { attempts: 0, resetAt: now + LIMIT_WINDOW };
    const gate = globalAuth.asteriaLoginGate;
    if (gate.attempts >= MAX_ATTEMPTS) throw apiError('Too many sign-in attempts. Please try again in a few minutes.', 429, { 'Retry-After': String(Math.ceil((gate.resetAt - now) / 1000)) });
    // Reserve the attempt before expensive hashing to limit concurrent brute-force attempts.
    gate.attempts++;
    const raw = await readLoginBody(request);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { throw apiError('Please enter your email and password.', 400); }
    const data = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    const matches = await verifyPassword(password, config.passwordHash);
    if (!matches || email !== config.email) throw apiError('The email or password is incorrect.', 401);
    // A correct sign-in clears failures. Signed sessions can be revoked by rotating the hash or secret.
    globalAuth.asteriaLoginGate = { attempts: 0, resetAt: now + LIMIT_WINDOW };
    return Response.json({ authenticated: true, email: config.email }, { headers: { ...noStore, 'Set-Cookie': sessionCookie(request, createSessionToken()) } });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Admin sign-in could not be completed.');
    return apiError('Sign-in is temporarily unavailable. Please try again.', 500);
  }
}
export async function logoutAdmin(request: Request): Promise<Response> {
  try {
    checkRequestOrigin(request);
    return Response.json({ authenticated: false }, { headers: { ...noStore, 'Set-Cookie': sessionCookie(request, null) } });
  } catch (error) { return error instanceof Response ? error : apiError('Sign-out is temporarily unavailable.', 500); }
}
export function adminSessionResponse(request: Request): Response {
  const session = verifySessionToken(readCookie(request));
  return Response.json({ authenticated: Boolean(session), ...(session || {}), configured: isAdminConfigured() }, { headers: noStore });
}
