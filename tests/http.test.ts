import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readJsonBody } from '../lib/http';

const url = 'https://stars.example.com/api/stars';
const status = (expected: number) => (error: unknown) => error instanceof Response && error.status === expected;

test('JSON reader preserves ordinary JSON and multibyte text within the byte limit', async () => {
  const body = JSON.stringify({ message: 'A little light — étoile' });
  assert.deepEqual(await readJsonBody(new Request(url, { method: 'POST', body }), Buffer.byteLength(body)), { message: 'A little light — étoile' });
});

test('oversized chunked bodies are cancelled before all chunks are buffered', async () => {
  let cancelled = false;
  let pulled = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { pulled++; controller.enqueue(new Uint8Array(512).fill(120)); if (pulled === 100) controller.close(); },
    cancel() { cancelled = true; },
  });
  const request = new Request(url, { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
  await assert.rejects(readJsonBody(request, 1024), status(413));
  assert.equal(cancelled, true);
  assert.ok(pulled < 100);
});

test('declared oversized payloads are rejected and cancelled without reading', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  const request = new Request(url, { method: 'POST', body: stream, headers: { 'content-length': '99999' }, duplex: 'half' } as RequestInit);
  await assert.rejects(readJsonBody(request, 100), status(413));
  assert.equal(cancelled, true);
});

test('byte limits reject multibyte input even when its character count is shorter', async () => {
  const body = JSON.stringify({ message: 'é'.repeat(50) });
  assert.ok(body.length < 100);
  assert.ok(Buffer.byteLength(body) > 100);
  await assert.rejects(readJsonBody(new Request(url, { method: 'POST', body }), 100), status(413));
});

test('invalid JSON, invalid UTF-8, and absent bodies receive a client error', async () => {
  await assert.rejects(readJsonBody(new Request(url, { method: 'POST', body: '{invalid}' })), status(400));
  await assert.rejects(readJsonBody(new Request(url, { method: 'POST', body: new Uint8Array([0xff]) })), status(400));
  await assert.rejects(readJsonBody(new Request(url, { method: 'POST' })), status(400));
});
