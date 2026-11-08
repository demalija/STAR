import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

const origin = new URL(process.env.E2E_BASE_URL || 'http://127.0.0.1:3000').origin;
const headers = { Origin: origin };
function credentials(): { email: string; password: string } {
  if (process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD) {
    return { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
  }
  try {
    const value = JSON.parse(readFileSync(process.env.E2E_AUTH_FILE || '/tmp/asteria-test-auth.json', 'utf8'));
    if (typeof value.email === 'string' && typeof value.password === 'string') return value;
  } catch { /* Show a useful setup error instead of exposing any credential contents. */ }
  throw new Error('Admin browser tests require E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD or E2E_AUTH_FILE pointing to a private {email,password} JSON file. Match the running server configuration.');
}
async function login(request: APIRequestContext) {
  const response = await request.post('/api/admin/auth/login', { headers, data: credentials() });
  expect(response.status()).toBe(200);
  return response;
}
async function uiLogin(page: Page) {
  const account = credentials();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel('Email address', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Enter the studio' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1, name: /Your universe/ })).toBeVisible();
  await expect(page.getByText('All dedications', { exact: true })).toBeVisible();
}
const example = {
  starName: 'Studio’s Private Light', recipientName: 'Mira', senderName: 'The studio',
  dedication: 'A little light for every new beginning. With love, always.',
  occasion: 'New beginning', dedicationDate: '2026-11-08', email: 'private@example.com', status: 'draft',
};

test('admin rejects anonymous access, invalid credentials and forged sessions', async ({ request, page }) => {
  const session = await request.get('/api/admin/auth/session');
  expect((await session.json()).authenticated).toBe(false);
  for (const endpoint of ['/api/admin/stars', '/api/admin/overview', '/api/admin/content', '/api/admin/settings', '/api/admin/export']) {
    expect((await request.get(endpoint)).status(), endpoint).toBe(401);
  }
  const denied = await request.post('/api/admin/auth/login', { headers, data: { email: credentials().email, password: 'incorrect-password-for-test' } });
  expect(denied.status()).toBe(401);
  const forged = await request.get('/api/admin/stars', { headers: { Cookie: 'asteria_admin_session=forged.invalid' } });
  expect(forged.status()).toBe(401);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('owner manages draft, publish, archive, PDF generation and deletion', async ({ request }) => {
  const authentication = await login(request);
  expect(authentication.headers()['set-cookie']).toMatch(/HttpOnly/i);
  expect(authentication.headers()['set-cookie']).toMatch(/SameSite=Strict/i);
  const created = await request.post('/api/admin/stars', { headers, data: example });
  expect(created.status()).toBe(201);
  const { star } = await created.json();
  try {
    expect(star.status).toBe('draft');
    expect(star.email).toBe(example.email);
    expect((await request.get(`/api/stars/${star.id}`)).status()).toBe(404);
    expect((await request.get(`/api/stars/${star.id}/certificate`)).status()).toBe(404);
    const draftPdf = await request.get(`/api/admin/stars/${star.id}/certificate`);
    expect(draftPdf.status()).toBe(200);
    expect(draftPdf.headers()['content-type']).toContain('application/pdf');
    expect((await draftPdf.body()).subarray(0, 4).toString()).toBe('%PDF');
    expect((await PDFDocument.load(await draftPdf.body())).getPageCount()).toBeGreaterThan(0);
    const foreignOrigin = await request.patch(`/api/admin/stars/${star.id}`, { headers: { Origin: 'https://unrelated.example' }, data: { status: 'published' } });
    expect(foreignOrigin.status()).toBe(403);
    const published = await request.patch(`/api/admin/stars/${star.id}`, { headers, data: { status: 'published', starName: 'Studio’s Bright Light' } });
    expect(published.status()).toBe(200);
    const publicStar = await request.get(`/api/stars/${star.id}`);
    expect(publicStar.status()).toBe(200);
    expect((await publicStar.json()).star).not.toHaveProperty('email');
    const pdf = await request.get(`/api/stars/${star.id}/certificate`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-disposition']).toMatch(/attachment.*\.pdf/i);
    expect((await PDFDocument.load(await pdf.body())).getPageCount()).toBeGreaterThan(0);
    const matches = await request.get(`/api/admin/stars?search=${encodeURIComponent(star.code)}&status=published`);
    expect((await matches.json()).stars.some((item: {id: string}) => item.id === star.id)).toBe(true);
    const archived = await request.patch(`/api/admin/stars/${star.id}`, { headers, data: { status: 'archived' } });
    expect(archived.status()).toBe(200);
    expect((await request.get(`/api/stars/${star.id}`)).status()).toBe(404);
    const overview = await request.get('/api/admin/overview');
    expect(overview.status()).toBe(200);
    const counts = await overview.json();
    expect(counts.total).toBe(counts.published + counts.draft + counts.archived);
  } finally {
    expect((await request.delete(`/api/admin/stars/${star.id}`, { headers })).status()).toBe(200);
  }
  expect((await request.get(`/api/admin/stars/${star.id}`)).status()).toBe(404);
});

test('owner publishes website content, configuration stays private, logout revokes access', async ({ request, page }) => {
  await login(request);
  const current = await request.get('/api/admin/content');
  expect(current.status()).toBe(200);
  const { content } = await current.json();
  const announcement = 'A little universe, lovingly managed from the studio.';
  try {
    const updated = await request.put('/api/admin/content', { headers, data: { content: { ...content, announcement } } });
    expect(updated.status()).toBe(200);
    await page.goto('/');
    await expect(page.locator('.announcement')).toContainText(announcement);
    const settings = await request.get('/api/admin/settings');
    expect(settings.status()).toBe(200);
    const publicSettings = await settings.json();
    expect(publicSettings.authentication.configured).toBe(true);
    expect(JSON.stringify(publicSettings)).not.toContain(credentials().password);
    expect(JSON.stringify(publicSettings)).not.toMatch(/scrypt:16384|postgres(?:ql)?:\/\//);
    const exported = await request.get('/api/admin/export');
    expect(exported.status()).toBe(200);
    expect(exported.headers()['content-type']).toContain('text/csv');
    const denied = await request.put('/api/admin/content', { headers, data: { content: { ...content, announcement: '<script>not-executed</script>' } } });
    expect(denied.status()).toBe(200);
    await page.reload();
    await expect(page.locator('.announcement')).toContainText('<script>not-executed</script>');
    expect(await page.locator('.announcement script').count()).toBe(0);
  } finally {
    expect((await request.put('/api/admin/content', { headers, data: { content } })).status()).toBe(200);
  }
  expect((await request.post('/api/admin/auth/logout', { headers })).status()).toBe(200);
  expect((await request.get('/api/admin/stars')).status()).toBe(401);
});

test('studio UI creates and edits a dedication, downloads its certificate, and signs out', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await uiLogin(page);
  await page.screenshot({ path: '/tmp/admin-dashboard.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'New dedication', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('Star name', { exact: true }).fill('A Studio Universe');
  await editor.getByLabel('Recipient name', { exact: true }).fill('Mira');
  await editor.getByLabel('Sender name', { exact: true }).fill('The studio');
  await editor.getByLabel('Personal dedication').fill('The smallest gesture can hold the whole sky.');
  await editor.getByLabel('Visibility').selectOption('draft');
  const save = page.waitForResponse(response => response.url().endsWith('/api/admin/stars') && response.request().method() === 'POST');
  await editor.getByRole('button', { name: 'Create dedication', exact: true }).click();
  const response = await save;
  expect(response.status()).toBe(201);
  const { star } = await response.json();
  try {
    await expect(editor).not.toBeVisible();
    await page.getByRole('button', { name: 'Dedications', exact: false }).first().click();
    await page.getByLabel('Search dedications').fill('A Studio Universe');
    await expect(page.getByRole('button', { name: 'Edit A Studio Universe', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Edit A Studio Universe', exact: true }).click();
    await editor.getByLabel('Visibility').selectOption('published');
    await editor.getByRole('button', { name: 'Save dedication', exact: true }).click();
    await expect(editor).not.toBeVisible();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download certificate for A Studio Universe', exact: true }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    expect(await download.failure()).toBeNull();
    await page.getByRole('button', { name: 'Settings & health', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: /peace of mind/ })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    expect((await page.request.delete(`/api/admin/stars/${star.id}`, { headers })).status()).toBe(200);
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('admin navigation and editor fit a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await uiLogin(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Open studio navigation' }).click();
  await page.getByRole('button', { name: 'Website content', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save & publish', exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '/tmp/admin-mobile.png', fullPage: true, animations: 'disabled' });
});
