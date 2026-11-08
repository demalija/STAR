import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAdminStar, ValidationError } from '../lib/stars';

const input = { starName: 'A light', recipientName: 'Amelia', senderName: 'Alex', dedication: 'Our universe.' };
test('admin visibility rejects arrays and objects rather than coercing their string representation', async () => {
  for (const status of [['published'], ['draft'], { toString: () => 'published' }, null, 42]) {
    await assert.rejects(createAdminStar({ ...input, status }), error => error instanceof ValidationError && Object.hasOwn(error.fields, 'status'));
  }
});
