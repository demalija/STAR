import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { readDocument, storageMode, writeDocument } from '../lib/storage';
import { getAdminStar, getStar, migrateLocalData } from '../lib/stars';

let directory: string;
before(async () => { directory = await mkdtemp(path.join(os.tmpdir(), 'asteria-storage-')); process.env.STAR_DATA_DIR = directory; });
after(async () => { delete process.env.STAR_DATA_DIR; await rm(directory, { recursive: true, force: true }); });

test('settings writes preserve independent documents under concurrency', async () => {
  const defaults = { title: 'Default' };
  assert.deepEqual(await readDocument('site', defaults), defaults);
  await Promise.all(Array.from({ length: 15 }, (_, index) => writeDocument(`document-${index}`, { index })));
  for (let index = 0; index < 15; index++) assert.deepEqual(await readDocument(`document-${index}`, {}), { index });
  await writeDocument('site', { title: 'A new universe' });
  assert.equal((await readDocument('site', defaults)).title, 'A new universe');
  const persisted = JSON.parse(await readFile(path.join(directory, 'settings.json'), 'utf8'));
  assert.equal(Object.keys(persisted).length, 16);
  await assert.rejects(() => readDocument('../outside', {}), /Invalid document key/);
});

test('legacy records remain published and gain update timestamps without destructive migration', async () => {
  const legacy = { id: 'd290f1ee-6c54-4b01-90e6-d701748f0851', code: 'AST-1234ABCD', starName: 'Legacy light', recipientName: 'Amelia', senderName: 'Alex', dedication: 'Before the new registry.', occasion: 'Birthday', dedicationDate: '2026-11-08', createdAt: '2026-11-08T10:00:00.000Z', coordinates: { ra: '01h 00m 00s', dec: '+01° 00′ 00″' }, constellation: 'Lyra', distance: 50, email: 'owner@example.com' };
  const raw = JSON.stringify({ version: 1, stars: [legacy] });
  await writeFile(path.join(directory, 'stars.json'), raw);
  assert.equal((await getStar(legacy.code.toLowerCase()))?.id, legacy.id);
  const admin = await getAdminStar(legacy.id);
  assert.equal(admin?.status, 'published');
  assert.equal(admin?.updatedAt, legacy.createdAt);
  assert.equal(admin?.email, legacy.email);
  assert.equal((await getStar(legacy.id))?.starName, legacy.starName);
  assert.equal('email' in (await getStar(legacy.id))!, false);
  assert.equal(await readFile(path.join(directory, 'stars.json'), 'utf8'), raw);
});

test('Vercel never silently falls back to ephemeral JSON storage', async () => {
  const previous = process.env.VERCEL;
  const oldUrl = process.env.DATABASE_URL;
  process.env.VERCEL = '1';
  delete process.env.DATABASE_URL;
  assert.throws(() => storageMode(), /DATABASE_URL is required/);
  await assert.rejects(() => writeDocument('site', {}), /DATABASE_URL is required/);
  if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous;
  if (oldUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = oldUrl;
});

test('migration requires an explicitly configured PostgreSQL destination', async () => {
  await assert.rejects(() => migrateLocalData(), /Set DATABASE_URL/);
});
