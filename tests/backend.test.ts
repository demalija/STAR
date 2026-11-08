import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { createStar, getStar, validateStarInput, ValidationError } from '../lib/stars';

let directory: string;
const input = {
  starName: '  Our forever light  ', recipientName: 'Amelia', senderName: 'Alex',
  dedication: 'For all the nights we have yet to share.', email: 'alex@example.com',
  occasion: 'Anniversary', dedicationDate: '2026-11-08',
};
before(async () => { directory = await mkdtemp(path.join(os.tmpdir(), 'star-registry-test-')); process.env.STAR_DATA_DIR = directory; });
after(async () => { delete process.env.STAR_DATA_DIR; await rm(directory, { recursive: true, force: true }); });

test('dedications persist across reads and keep email private', async () => {
  const star = await createStar(input);
  assert.equal(star.starName, 'Our forever light');
  assert.equal('email' in star, false);
  assert.match(star.id, /^[0-9a-f-]{36}$/);
  assert.match(star.code, /^AST-[0-9A-F]{8}$/);
  assert.deepEqual(await getStar(star.id), star);
  assert.deepEqual(await getStar(star.code.toLowerCase()), star);
  const stored = JSON.parse(await readFile(path.join(directory, 'stars.json'), 'utf8'));
  assert.equal(stored.stars[0].email, 'alex@example.com');
});

test('concurrent writes preserve every dedication', async () => {
  const created = await Promise.all(Array.from({ length: 12 }, (_, i) => createStar({ ...input, starName: `Light ${i}` })));
  assert.equal(new Set(created.map(star => star.id)).size, 12);
  for (const star of created) assert.deepEqual(await getStar(star.id), star);
  const stored = JSON.parse(await readFile(path.join(directory, 'stars.json'), 'utf8'));
  assert.equal(stored.stars.length, 13);
});

test('invalid input and dates are rejected without writes', () => {
  for (const invalid of [null, [], { ...input, starName: '' }, { ...input, recipientName: 42 }, { ...input, dedicationDate: '2026-02-30' }, { ...input, email: 'not-an-email' }, { ...input, dedication: 'x'.repeat(1201) }]) {
    assert.throws(() => validateStarInput(invalid), ValidationError);
  }
});

test('missing and invalid IDs return no star', async () => {
  assert.equal(await getStar('../../etc/passwd'), null);
  assert.equal(await getStar('AST-NOTACODE'), null);
  assert.equal(await getStar('d290f1ee-6c54-4b01-90e6-d701748f0851'), null);
});

test('public demo returns a sample dedication without a store write', async () => {
  const before = await readFile(path.join(directory, 'stars.json'), 'utf8');
  const demo = await getStar('demo');
  assert.equal(demo?.starName, 'Amelia');
  assert.equal(demo?.code, 'AST-DEMO');
  assert.equal('email' in demo!, false);
  assert.equal(await readFile(path.join(directory, 'stars.json'), 'utf8'), before);
});
