import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createAdminStar, createStar, deleteStar, getAdminStar, getOverview, getStar, listStars, migrateLocalData, updateStar } from '../lib/stars';
import { closeDatabase, getDatabase, readDocument, writeDocument } from '../lib/storage';

// Deliberately opt in with a dedicated test database. Never uses a production DATABASE_URL implicitly.
test('PostgreSQL persists concurrent dedications, admin lifecycle, settings, and idempotent migration', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const previousUrl = process.env.DATABASE_URL;
  const previousDirectory = process.env.STAR_DATA_DIR;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const directory = await mkdtemp(path.join(os.tmpdir(), 'asteria-pg-migration-'));
  process.env.STAR_DATA_DIR = directory;
  const prefix = `integration-${randomUUID()}`;
  const ids: string[] = [];
  try {
    const input = { starName: `${prefix} light`, recipientName: 'Integration Recipient', senderName: 'Integration Sender', dedication: 'A persisted PostgreSQL dedication.', email: 'integration@example.com', dedicationDate: '2026-11-08', occasion: 'Test' };
    const stars = await Promise.all(Array.from({ length: 16 }, (_, index) => createStar({ ...input, starName: `${prefix} ${index}` })));
    ids.push(...stars.map(star=>star.id));
    assert.equal(new Set(stars.map(star=>star.code)).size, 16);
    assert.equal((await listStars({ search: prefix, limit: 100 })).total, 16);
    for (const star of stars) {
      assert.deepEqual(await getStar(star.id), star);
      assert.equal((await getStar(star.code.toLowerCase()))?.id, star.id);
      assert.equal('email' in (await getStar(star.id))!, false);
      assert.equal((await getAdminStar(star.id))?.email, input.email);
    }
    await Promise.all([
      updateStar(stars[0].id, { dedication: 'A concurrent dedication update.' }),
      updateStar(stars[0].id, { senderName: 'Concurrent Sender' }),
    ]);
    const changed = await getAdminStar(stars[0].id);
    assert.equal(changed?.dedication, 'A concurrent dedication update.');
    assert.equal(changed?.senderName, 'Concurrent Sender');
    const draft = await createAdminStar({ ...input, status: 'draft' });
    ids.push(draft.id);
    assert.equal(await getStar(draft.id), null);
    await updateStar(draft.id, { status: 'published' });
    assert.equal((await getStar(draft.id))?.status, 'published');
    await updateStar(draft.id, { status: 'archived' });
    assert.equal(await getStar(draft.id), null);
    assert.ok((await getOverview()).total >= 17);
    await Promise.all(Array.from({ length: 8 }, (_, index) => writeDocument(`${prefix}-${index}`, { index })));
    for (let index = 0; index < 8; index++) assert.deepEqual(await readDocument(`${prefix}-${index}`, {}), { index });

    const legacy = { ...stars[0], id: randomUUID(), code: `AST-${randomUUID().replaceAll('-','').slice(0,8).toUpperCase()}`, starName: `${prefix} legacy`, email: 'legacy@example.com' };
    ids.push(legacy.id);
    await writeFile(path.join(directory,'stars.json'), JSON.stringify({ version: 1, stars: [legacy] }));
    await writeFile(path.join(directory,'settings.json'), JSON.stringify({ [`${prefix}-migrated`]: { imported: true } }));
    assert.deepEqual(await migrateLocalData(), { imported: 1, skipped: 0, settingsImported: 1 });
    assert.deepEqual(await migrateLocalData(), { imported: 0, skipped: 1, settingsImported: 0 });
    assert.equal((await getAdminStar(legacy.id))?.email, 'legacy@example.com');
    assert.equal((await getStar(legacy.code.toLowerCase()))?.id, legacy.id);
    assert.deepEqual(await readDocument(`${prefix}-migrated`, {}), { imported: true });
    assert.equal(await deleteStar(draft.id), true);
    assert.equal(await getAdminStar(draft.id), null);
  } finally {
    for (const id of ids) await deleteStar(id);
    const sql = await getDatabase();
    if (sql) await sql`DELETE FROM asteria_documents WHERE left(key,${prefix.length}) = ${prefix}`;
    await closeDatabase();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (previousDirectory === undefined) delete process.env.STAR_DATA_DIR; else process.env.STAR_DATA_DIR = previousDirectory;
    await rm(directory,{ recursive: true, force: true });
  }
});
