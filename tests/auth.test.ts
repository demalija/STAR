import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { hashPassword, verifyPassword, isAdminConfigured, createSessionToken, verifySessionToken, requireAdmin, checkRequestOrigin, sessionCookie, loginAdmin, adminSessionResponse, logoutAdmin, ADMIN_COOKIE, SESSION_SECONDS } from '../lib/auth';

const prior = { ADMIN_EMAIL: process.env.ADMIN_EMAIL, ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH, AUTH_SECRET: process.env.AUTH_SECRET, APP_URL: process.env.APP_URL };
const password = 'A test password! Long enough.';
let hash: string;
before(async () => {
  hash = await hashPassword(password);
  process.env.ADMIN_EMAIL = 'owner@example.com';
  process.env.ADMIN_PASSWORD_HASH = hash;
  process.env.AUTH_SECRET = 'a'.repeat(48);
  process.env.APP_URL = 'https://stars.example.com';
});
after(() => { for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
function request(method = 'GET', token?: string, origin?: string) {
  return new Request('https://stars.example.com/api/admin/stars', { method, headers: { ...(token ? { cookie: `${ADMIN_COOKIE}=${token}` } : {}), ...(origin ? { origin } : {}) } });
}

test('scrypt password hashes use random salts and verify safely', async () => {
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('wrong password', hash), false);
  assert.notEqual(await hashPassword(password), hash);
  assert.equal(await verifyPassword(password, 'invalid'), false);
  await assert.rejects(hashPassword('short'));
});
test('sessions reject tampering, expiry, and credential rotation', async () => {
  const now = Date.now();
  const token = createSessionToken(now);
  assert.deepEqual(verifySessionToken(token, now), { email: 'owner@example.com' });
  assert.equal(verifySessionToken(`${token.slice(0, 10)}x${token.slice(11)}`, now), null);
  assert.equal(verifySessionToken(token, now + (SESSION_SECONDS + 1) * 1000), null);
  process.env.ADMIN_PASSWORD_HASH = await hashPassword('Another perfectly secure test password.');
  assert.equal(verifySessionToken(token, now), null);
  process.env.ADMIN_PASSWORD_HASH = hash;
  process.env.AUTH_SECRET = 'b'.repeat(48);
  assert.equal(verifySessionToken(token, now), null);
  process.env.AUTH_SECRET = 'a'.repeat(48);
});
test('protected APIs require authenticated cookies and exact same-origin writes', async () => {
  const token = createSessionToken();
  await assert.rejects(requireAdmin(request()), error => error instanceof Response && error.status === 401);
  assert.deepEqual(await requireAdmin(request('GET', token)), { email: 'owner@example.com' });
  for (const origin of [undefined, 'https://evil.example.com', 'http://stars.example.com']) {
    await assert.rejects(requireAdmin(request('POST', token, origin)), error => error instanceof Response && error.status === 403);
  }
  assert.deepEqual(await requireAdmin(request('POST', token, 'https://stars.example.com')), { email: 'owner@example.com' });
  assert.throws(() => checkRequestOrigin(new Request('https://stars.example.com/api/admin', { method: 'POST', headers: { origin: 'https://stars.example.com', 'sec-fetch-site': 'cross-site' } })), error => error instanceof Response && error.status === 403);
  assert.match(sessionCookie(request(), token), /HttpOnly; SameSite=Strict/);
  assert.match(sessionCookie(request(), token), /; Secure$/);
});
test('login, session, and logout expose no password or secrets', async () => {
  const post = (email: string, value: string) => new Request('https://stars.example.com/api/admin/auth/login', { method: 'POST', headers: { origin: 'https://stars.example.com', 'content-type': 'application/json' }, body: JSON.stringify({ email, password: value }) });
  assert.equal((await loginAdmin(post('owner@example.com', 'wrong'))).status, 401);
  const response = await loginAdmin(post('OWNER@EXAMPLE.COM', password));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { authenticated: true, email: 'owner@example.com' });
  const cookie = response.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly/);
  assert.doesNotMatch(cookie, /scrypt:/);
  const session = adminSessionResponse(new Request('https://stars.example.com/api/admin/auth/session', { headers: { cookie } }));
  assert.deepEqual(await session.json(), { authenticated: true, email: 'owner@example.com', configured: true });
  const logout = await logoutAdmin(new Request('https://stars.example.com/api/admin/auth/logout', { method: 'POST', headers: { origin: 'https://stars.example.com' } }));
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie')!, /Max-Age=0/);
});
test('unconfigured or malformed admin secrets fail closed', async () => {
  delete process.env.AUTH_SECRET;
  assert.equal(isAdminConfigured(), false);
  assert.equal(verifySessionToken('anything'), null);
  await assert.rejects(requireAdmin(request()), error => error instanceof Response && error.status === 503);
  process.env.AUTH_SECRET = 'a'.repeat(48);
});

test('oversized login bodies and repeated failed attempts are bounded', async () => {
  const make = (body: string) => new Request('https://stars.example.com/api/admin/auth/login', { method: 'POST', headers: { origin: 'https://stars.example.com', 'content-type': 'application/json' }, body });
  const valid = JSON.stringify({ email: 'owner@example.com', password });
  assert.equal((await loginAdmin(make(valid))).status, 200);
  assert.equal((await loginAdmin(make('x'.repeat(5000)))).status, 413);
  for (let i = 0; i < 9; i++) assert.equal((await loginAdmin(make(JSON.stringify({ email: 'owner@example.com', password: 'wrong' })))).status, 401);
  const limited = await loginAdmin(make(valid));
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});
