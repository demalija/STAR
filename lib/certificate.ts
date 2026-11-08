import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { degrees, PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import type { Star } from './stars';

export type CertificateOptions = {
  brandName?: string;
  certificateTitle?: string;
  certificateSubtitle?: string;
  watermark?: string;
};

type CertificateStar = Pick<Star, 'id' | 'code' | 'starName' | 'recipientName' | 'senderName' | 'dedication' | 'dedicationDate' | 'createdAt' | 'coordinates' | 'constellation'>;
const colors = {
  paper: rgb(0.979, 0.971, 0.944), ink: rgb(0.17, 0.24, 0.2), green: rgb(0.065, 0.16, 0.15),
  muted: rgb(0.46, 0.5, 0.42), gold: rgb(0.69, 0.57, 0.34), paleGold: rgb(0.85, 0.8, 0.67),
};
const WIDTH = 841.89;
const HEIGHT = 595.28;
const BODY_LEFT = 308;
const BODY_WIDTH = 480;
const BODY_CENTER = BODY_LEFT + BODY_WIDTH / 2;
let fontBytes: Promise<[Buffer, Buffer]> | undefined;
const supportedCharacters = new WeakMap<PDFFont, Set<number>>();

function loadFonts() {
  fontBytes ??= Promise.all([
    readFile(path.join(process.cwd(), 'app/fonts/CormorantGaramond.ttf')),
    readFile(path.join(process.cwd(), 'app/fonts/DMSans.ttf')),
  ]);
  return fontBytes;
}

/** Keeps PDF output safe for fonts that don't include a decorative emoji or script. */
export function supportedCertificateText(text: string, font: PDFFont): string {
  let supported = supportedCharacters.get(font);
  if (!supported) { supported = new Set(font.getCharacterSet()); supportedCharacters.set(font, supported); }
  const replacement = supported.has(0x25a1) ? '□' : '?';
  return Array.from(text.normalize('NFC')).map(character => {
    if (character === '\n') return character;
    if (character === '\r') return '';
    if (character === '\t') return '    ';
    const code = character.codePointAt(0)!;
    if (code < 32 || code === 0x7f || code === 0x200d || (code >= 0xfe00 && code <= 0xfe0f)) return '';
    if (supported.has(code)) return character;
    if (code === 0x2032) return "'";
    if (code === 0x2033) return '"';
    if (code >= 0x1f000 && code <= 0x1ffff) return '*';
    return replacement;
  }).join('');
}

/** Width-aware wrapping, including words longer than a line and intentional newlines. */
export function wrapCertificateText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of supportedCertificateText(text, font).split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue; }
    let line = '';
    for (const word of paragraph.trim().split(/\s+/u)) {
      const combined = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(combined, size) <= maxWidth) { line = combined; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const character of Array.from(word)) {
        if (line && font.widthOfTextAtSize(line + character, size) > maxWidth) { lines.push(line); line = ''; }
        line += character;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function text(page: PDFPage, font: PDFFont, value: string, size: number, y: number, color = colors.ink, center = BODY_CENTER) {
  const clean = supportedCertificateText(value, font);
  page.drawText(clean, { x: center - font.widthOfTextAtSize(clean, size) / 2, y, size, font, color });
}

function starShape(page: PDFPage, x: number, y: number, radius: number, color = colors.paleGold) {
  page.drawSvgPath(`M 0 ${radius} Q 2 2 ${radius} 0 Q 2 -2 0 -${radius} Q -2 -2 -${radius} 0 Q -2 2 0 ${radius} Z`, { x, y, color });
}

function decorate(page: PDFPage, font: PDFFont, star: CertificateStar, brand: string, title: string, subtitle: string, pageIndex: number) {
  page.drawRectangle({ x: 0, y: 0, width: WIDTH, height: HEIGHT, color: colors.paper });
  page.drawRectangle({ x: 22, y: 22, width: WIDTH - 44, height: HEIGHT - 44, borderColor: colors.paleGold, borderWidth: 0.6 });
  page.drawRectangle({ x: 22, y: 22, width: 248, height: HEIGHT - 44, color: colors.green });
  for (let i = 0; i < 110; i++) {
    page.drawCircle({ x: 31 + (i * 37.07) % 230, y: 38 + (i * 87.71) % 518, size: i % 11 ? 0.5 : 1.1, color: colors.paleGold, opacity: i % 4 ? 0.45 : 0.8 });
  }
  const orbit = { x: 146, y: 315, borderColor: colors.paleGold, borderWidth: 0.5, borderOpacity: 0.24 };
  page.drawEllipse({ ...orbit, xScale: 100, yScale: 175 });
  page.drawEllipse({ ...orbit, xScale: 100, yScale: 60, rotate: degrees(44) });
  page.drawEllipse({ ...orbit, xScale: 100, yScale: 60, rotate: degrees(-44) });
  page.drawCircle({ x: 146, y: 315, size: 54, color: colors.gold, opacity: 0.05 });
  page.drawCircle({ x: 146, y: 315, size: 28, color: colors.gold, opacity: 0.06 });
  starShape(page, 146, 315, 22);
  text(page, font, 'YOUR PLACE IN THE UNIVERSE', 5.8, 529, colors.paleGold, 146);
  text(page, font, star.coordinates.ra, 7, 105, colors.paleGold, 146);
  text(page, font, star.coordinates.dec, 7, 89, colors.paleGold, 146);
  text(page, font, `${star.constellation} · illustrated sky`, 6.4, 65, colors.paleGold, 146);
  wrapCertificateText(title.toUpperCase(), font, 7.2, BODY_WIDTH).forEach((line, i) => text(page, font, line, 7.2, 535 - i * 11, colors.gold));
  if (pageIndex > 0) wrapCertificateText(`${star.starName} · dedication continued`, font, 9.5, BODY_WIDTH).forEach((line, i) => text(page, font, line, 9.5, 503 - i * 14, colors.muted));
  page.drawLine({ start: { x: BODY_LEFT, y: 93 }, end: { x: BODY_LEFT + BODY_WIDTH, y: 93 }, color: colors.paleGold, thickness: 0.5 });
  const brandText = supportedCertificateText(brand, font);
  let brandSize = 14;
  while (font.widthOfTextAtSize(brandText, brandSize) > 160 && brandSize > 6) brandSize -= 0.5;
  page.drawText(brandText, { x: BODY_LEFT, y: 68, font, size: brandSize, color: colors.muted });
  const subtitleLines = wrapCertificateText(subtitle, font, 6.5, 290);
  subtitleLines.forEach((line, i) => page.drawText(line, { x: BODY_LEFT + BODY_WIDTH - font.widthOfTextAtSize(line, 6.5), y: 78 - i * 9, font, size: 6.5, color: colors.muted }));
  text(page, font, 'A symbolic keepsake. No official astronomical naming rights or ownership.', 6.2, 42, colors.muted);
}

/** Generates a self-contained, downloadable PDF with embedded fonts and vector artwork. */
export async function generateCertificate(star: CertificateStar, options: CertificateOptions = {}): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const [serifBytes, sansBytes] = await loadFonts();
  // Keep complete variable font tables: subsetting these fonts drops visible glyphs in PDF renderers.
  const serif = await document.embedFont(serifBytes, { subset: false });
  const sans = await document.embedFont(sansBytes, { subset: false });
  const brand = (options.brandName || 'Asteria').slice(0, 50);
  const title = (options.certificateTitle || 'A celestial dedication').slice(0, 80);
  const subtitle = (options.certificateSubtitle || 'A symbolic dedication, written in the stars.').slice(0, 200);
  document.setTitle(`${star.starName} — ${brand} star dedication`);
  document.setAuthor(brand);
  document.setSubject(`Personal symbolic star dedication ${star.code}`);
  document.setKeywords(['star dedication', 'symbolic certificate', star.code]);
  document.setCreator(`${brand} certificate studio`);

  let pageIndex = 0;
  let page!: PDFPage;
  function addPage() {
    page = document.addPage([WIDTH, HEIGHT]);
    decorate(page, sans, star, brand, title, subtitle, pageIndex);
    if (options.watermark) {
      page.drawText(supportedCertificateText(options.watermark.toUpperCase().slice(0, 20), sans), {
        x: 350, y: 230, size: 55, font: sans, color: colors.gold, opacity: 0.09, rotate: degrees(25),
      });
    }
    pageIndex++;
  }
  addPage();
  let y = 483;
  const nameLines = wrapCertificateText(star.starName, serif, 37, BODY_WIDTH);
  nameLines.forEach(line => { text(page, serif, line, 37, y); y -= 42; });
  y -= 1;
  const recipientLines = wrapCertificateText(`Dedicated with love to ${star.recipientName}`, sans, 9, BODY_WIDTH - 20);
  recipientLines.forEach(line => { text(page, sans, line, 9, y, colors.muted); y -= 15; });
  y -= 8;
  page.drawLine({ start: { x: BODY_CENTER - 50, y }, end: { x: BODY_CENTER - 10, y }, color: colors.paleGold, thickness: 0.5 });
  page.drawLine({ start: { x: BODY_CENTER + 10, y }, end: { x: BODY_CENTER + 50, y }, color: colors.paleGold, thickness: 0.5 });
  starShape(page, BODY_CENTER, y, 3, colors.gold);
  y -= 30;
  const dedicationSize = star.dedication.length > 600 ? 14.5 : 17;
  const lineHeight = dedicationSize * 1.4;
  const dedicationLines = wrapCertificateText(`“${star.dedication}”`, serif, dedicationSize, BODY_WIDTH - 20);
  for (const line of dedicationLines) {
    if (y < 214) { addPage(); y = 452; }
    text(page, serif, line, dedicationSize, y, colors.muted);
    y -= lineHeight;
  }
  const senderLines = wrapCertificateText(star.senderName, serif, 23, BODY_WIDTH - 40);
  const signatureHeight = 22 + senderLines.length * 27;
  if (y - signatureHeight < 138) { addPage(); y = 452; }
  y -= 17;
  text(page, sans, 'With all my love,', 8, y, colors.muted);
  y -= 29;
  senderLines.forEach(line => { text(page, serif, line, 23, y, colors.muted); y -= 27; });
  const parsedDate = new Date(`${star.dedicationDate || star.createdAt.slice(0, 10)}T12:00:00Z`);
  const date = Number.isFinite(parsedDate.getTime()) ? new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(parsedDate) : star.dedicationDate;
  // Every page repeats the dedication identifier; only the final page has the signature.
  for (const [index, certificatePage] of document.getPages().entries()) {
    const leftCenter = BODY_LEFT + BODY_WIDTH * 0.25;
    const rightCenter = BODY_LEFT + BODY_WIDTH * 0.75;
    text(certificatePage, sans, 'WRITTEN IN THE STARS', 5.8, 126, colors.gold, leftCenter);
    text(certificatePage, sans, 'DEDICATION NUMBER', 5.8, 126, colors.gold, rightCenter);
    text(certificatePage, sans, date, 8.3, 108, colors.muted, leftCenter);
    text(certificatePage, sans, star.code, 8.3, 108, colors.muted, rightCenter);
    if (document.getPageCount() > 1) text(certificatePage, sans, `${index + 1} / ${document.getPageCount()}`, 5.5, 27, colors.muted);
  }
  return document.save();
}

export function certificateFilename(star: Pick<Star, 'code'>): string {
  return `${star.code.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || 'asteria'}-certificate.pdf`;
}
