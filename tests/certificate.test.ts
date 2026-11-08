import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument } from 'pdf-lib';
import { certificateFilename, generateCertificate, supportedCertificateText, wrapCertificateText } from '../lib/certificate';

const dedication = {
  id: '65a8c30a-e4cc-4180-a576-1487a9e1a393', code: 'AST-1234ABCD', starName: 'Amelia’s Light',
  recipientName: 'Amelia', senderName: 'Alex', dedication: 'In every universe, I would still find you.',
  dedicationDate: '2026-11-08', createdAt: '2026-11-08T12:00:00Z',
  coordinates: { ra: '18h 36m 56s', dec: '+38° 47′ 01″' }, constellation: 'Lyra',
};

test('a real PDF embeds fonts and has a personal title and printable landscape page', async () => {
  const bytes = await generateCertificate(dedication);
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-');
  const document = await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(), 1);
  assert.match(document.getTitle()!, /Amelia’s Light/);
  const page = document.getPage(0);
  assert.ok(page.getWidth() > page.getHeight());
  // Complete variable font tables prevent missing visible glyphs in PDF renderers.
  assert.ok(bytes.length > 300000);
});

test('long names and 1200-character dedication flow onto continuation pages', async () => {
  const bytes = await generateCertificate({
    ...dedication, starName: 'W'.repeat(60), recipientName: 'M'.repeat(80), senderName: 'M'.repeat(80),
    dedication: 'Love'.repeat(300),
  }, { watermark: 'draft', brandName: 'Our little universe', certificateTitle: 'A celestial dedication' });
  const document = await PDFDocument.load(bytes);
  assert.ok(document.getPageCount() >= 2);
  assert.ok(document.getPageCount() <= 4);
  assert.ok(document.getPages().every(page => page.getWidth() > 800 && page.getHeight() > 590));
});

test('text wrapping never exceeds the available column, including unbroken words', async () => {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(await readFile(path.join(process.cwd(), 'app/fonts/DMSans.ttf')));
  const source = 'M'.repeat(1200);
  const lines = wrapCertificateText(source, font, 17, 460);
  assert.equal(lines.join(''), source);
  assert.ok(lines.every(line => font.widthOfTextAtSize(line, 17) <= 460));
  assert.equal(wrapCertificateText('First\n\nLast', font, 17, 460).join('\n'), 'First\n\nLast');
  assert.doesNotThrow(() => supportedCertificateText('Amélie · Γαλήνη · 🌟 💫 你好', font));
  assert.equal(supportedCertificateText('47′ 01″', font), "47' 01\"");
});

test('unsupported decorative characters do not prevent PDF generation', async () => {
  const bytes = await generateCertificate({ ...dedication, starName: 'Amélie 🌟', dedication: 'Our light · Γαλήνη · 💫 · 你好' });
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
  assert.equal(certificateFilename({ code: '../../bad\"\r\n.pdf' }), 'badpdf-certificate.pdf');
});
