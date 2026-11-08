import { expect, test } from '@playwright/test';

test('API validates input and persists a private-email-free dedication', async ({ request }) => {
  const invalid = await request.post('/api/stars', { data: { starName: '' } });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).fields).toHaveProperty('starName');

  const response = await request.post('/api/stars', {
    data: {
      starName: 'Our Quiet Universe',
      recipientName: 'Luna',
      senderName: 'Alex',
      dedication: 'For every little moment that became our whole universe.',
      email: 'private@example.com',
      occasion: 'Anniversary',
      dedicationDate: '2026-11-08',
    },
  });
  expect(response.status()).toBe(201);
  const { star } = await response.json();
  expect(star.starName).toBe('Our Quiet Universe');
  expect(star).not.toHaveProperty('email');
  expect(star.coordinates.ra).toMatch(/h .*m .*s/);
  const saved = await request.get(`/api/stars/${star.id}`);
  expect(saved.status()).toBe(200);
  expect((await saved.json()).star).toEqual(star);
  const missing = await request.get('/api/stars/not-a-star');
  expect(missing.status()).toBe(404);
});

test('a saved gift unwraps into its personal certificate and can be shared', async ({ page, request, context }) => {
  const dedication = {
    starName: 'Luna’s Light',
    recipientName: 'Luna',
    senderName: 'Alex',
    dedication: 'For every little moment that became our whole universe.',
    occasion: 'Anniversary',
    dedicationDate: '2026-11-08',
  };
  const created = await request.post('/api/stars', { data: dedication });
  expect(created.status()).toBe(201);
  const { star } = await created.json();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`/gift/${star.id}`);
  await expect(page.getByRole('heading', { name: /Some things are written in the stars/ })).toBeVisible();
  await expect(page.getByText('Luna, there’s a little magic waiting for you.')).toBeVisible();
  await page.screenshot({ path: '/tmp/asteria-gift-wrapped.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Unwrap your gift', exact: true }).click();
  const certificate = page.getByRole('article', { name: `Star dedication certificate for ${dedication.starName}` });
  await expect(certificate).toBeVisible();
  await expect(certificate.getByRole('heading', { name: dedication.starName })).toBeVisible();
  await expect(certificate.getByText(`“${dedication.dedication}”`)).toBeVisible();
  await expect(certificate.getByText(star.code)).toBeVisible();
  await expect(certificate.getByText('November 8, 2026')).toBeVisible();
  await page.getByRole('button', { name: 'Copy gift link', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Gift link copied', exact: true })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(`/gift/${star.id}`);
  await page.screenshot({ path: '/tmp/asteria-gift-revealed.png', fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
});

test('a missing dedication presents a useful recovery link', async ({ page }) => {
  await page.goto('/gift/not-a-star');
  await expect(page.getByRole('heading', { name: 'This star is a little out of reach.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Discover Asteria/ })).toHaveAttribute('href', '/');
});

test('the naming wizard creates a real dedication and opens its gift', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Some gifts are written in the stars/ })).toBeVisible();
  await page.screenshot({ path: '/tmp/asteria-home-desktop.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Find their star', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Write their dedication', exact: true }).click();
  await expect(page.getByLabel('Their name', { exact: true })).toBeVisible();
  await page.getByLabel('Their name', { exact: true }).fill('Maya');
  await page.getByLabel('What shall we call their star?').fill('Maya’s Forever');
  await page.getByLabel('A reason to celebrate').selectOption('Love & anniversary');
  await page.getByRole('button', { name: 'Write their dedication', exact: true }).click();
  await page.getByLabel('Your dedication', { exact: true }).fill('A thousand skies, and I would still find you.');
  await page.getByLabel('With love, from').fill('Sam');
  await page.getByRole('button', { name: 'One last little thing', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Maya’s Forever', exact: true })).toBeVisible();
  await page.getByLabel('A date to remember').fill('2026-11-08');
  const saved = page.waitForResponse(response => response.url().endsWith('/api/stars') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create their star', exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(201);
  const { star } = await response.json();
  expect(star.recipientName).toBe('Maya');
  expect(star.occasion).toBe('Love & anniversary');
  await expect(page.getByLabel('Their personal gift link')).toHaveValue(new RegExp(`/gift/${star.id}$`));
  await page.getByRole('link', { name: 'Unwrap their gift', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/gift/${star.id}$`));
  await page.getByRole('button', { name: 'Break the seal and unwrap your gift' }).click();
  await expect(page.getByRole('article', { name: 'Star dedication certificate for Maya’s Forever' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a recipient can look up a gift using its short code', async ({ page, request }) => {
  const response = await request.post('/api/stars', { data: {
    starName: 'A Place for Us', recipientName: 'Luca', senderName: 'Noa',
    dedication: 'Our own little corner of the sky.',
  } });
  expect(response.status()).toBe(201);
  const { star } = await response.json();
  await page.goto('/');
  await page.getByRole('button', { name: 'Unwrap a gift', exact: true }).click();
  await page.getByLabel('Your gift link or code').fill('not-a-valid-code');
  await page.getByRole('button', { name: 'Find my gift', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Enter the gift link');
  await page.getByLabel('Your gift link or code').fill(star.code);
  await page.getByRole('button', { name: 'Find my gift', exact: true }).click();
  await expect(page.getByText('Luca, there’s a little magic waiting for you.')).toBeVisible();
});

test('mobile navigation, wizard and gift fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Some gifts are written in the stars/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '/tmp/asteria-home-mobile.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Unwrap a gift', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Find their star', exact: true }).click();
  await expect(page.getByLabel('Their name', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto('/gift/demo');
  await page.getByRole('button', { name: 'Unwrap your gift', exact: true }).click();
  await expect(page.getByRole('article')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '/tmp/asteria-gift-mobile.png', fullPage: true, animations: 'disabled' });
});

test('long personal text stays readable on small screens and prints a certificate', async ({ page, request }) => {
  const response = await request.post('/api/stars', { data: {
    starName: 'S'.repeat(60), recipientName: 'R'.repeat(80), senderName: 'A'.repeat(80),
    dedication: 'Love'.repeat(300), dedicationDate: '2026-11-08',
  } });
  expect(response.status()).toBe(201);
  const { star } = await response.json();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`/gift/${star.id}`);
  await page.getByRole('button', { name: 'Unwrap your gift', exact: true }).click();
  const certificate = page.getByRole('article');
  await expect(certificate).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(certificate.getByRole('heading', { name: star.starName, exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/asteria-gift-long-mobile.png', fullPage: true, animations: 'disabled' });
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.gift-header')).toBeHidden();
  await expect(page.getByRole('button', { name: /Download certificate/ })).toBeHidden();
  await expect(certificate).toBeVisible();
  await page.pdf({ path: '/tmp/asteria-certificate-long.pdf', format: 'A4', printBackground: true, margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' } });
});
