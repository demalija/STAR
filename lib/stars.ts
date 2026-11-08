import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface Star {
  id: string;
  code: string;
  starName: string;
  recipientName: string;
  senderName: string;
  dedication: string;
  occasion: string;
  dedicationDate: string;
  createdAt: string;
  coordinates: { ra: string; dec: string };
  constellation: string;
  /** Illustrative distance in light years, not an astronomical catalog record. */
  distance: number;
}

interface StoredStar extends Star { email?: string }
interface Store { version: 1; stars: StoredStar[] }
export interface StarInput {
  starName: string;
  recipientName: string;
  senderName: string;
  dedication: string;
  email?: string;
  occasion: string;
  dedicationDate: string;
}

export class ValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super(Object.values(fields)[0] ?? 'Please check your dedication.');
    this.name = 'ValidationError';
  }
}

const forbiddenControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

export function validateStarInput(value: unknown): StarInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError({ form: 'Please provide a star dedication.' });
  }
  const source = value as Record<string, unknown>;
  const fields: Record<string, string> = {};
  function text(key: string, label: string, max: number, fallback?: string): string {
    const raw = source[key] ?? fallback;
    if (typeof raw !== 'string' || !raw.trim()) {
      fields[key] = `${label} is required.`;
      return '';
    }
    const cleaned = raw.trim();
    if (cleaned.length > max) fields[key] = `${label} must be ${max} characters or fewer.`;
    if (forbiddenControls.test(cleaned)) fields[key] = `${label} contains unsupported characters.`;
    if (key !== 'dedication' && /[\r\n]/u.test(cleaned)) fields[key] = `${label} must be on one line.`;
    return cleaned;
  }
  const starName = text('starName', 'Star name', 60);
  const recipientName = text('recipientName', 'Recipient name', 80);
  const senderName = text('senderName', 'Your name', 80);
  const dedication = text('dedication', 'Dedication', 1200);
  const occasion = text('occasion', 'Occasion', 60, 'Just because');
  const dedicationDate = text('dedicationDate', 'Dedication date', 10, new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dedicationDate) ||
      !Number.isFinite(Date.parse(`${dedicationDate}T12:00:00Z`)) ||
      new Date(`${dedicationDate}T12:00:00Z`).toISOString().slice(0, 10) !== dedicationDate) {
    fields.dedicationDate = 'Choose a valid dedication date.';
  }
  let email: string | undefined;
  if (source.email !== undefined && source.email !== '') {
    if (typeof source.email !== 'string' || source.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(source.email.trim())) {
      fields.email = 'Enter a valid email address.';
    } else email = source.email.trim();
  }
  if (Object.keys(fields).length) throw new ValidationError(fields);
  return { starName, recipientName, senderName, dedication, occasion, dedicationDate, ...(email ? { email } : {}) };
}

const constellations = ['Lyra', 'Cygnus', 'Cassiopeia', 'Orion', 'Andromeda', 'Pegasus', 'Aquila', 'Perseus'];

function celestialDetails(id: string): Pick<Star, 'coordinates' | 'constellation' | 'distance'> {
  const hash = createHash('sha256').update(id).digest();
  const seconds = hash.readUInt32BE(0) % 86400;
  const decSeconds = hash.readUInt32BE(4) % 324000;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    coordinates: {
      ra: `${pad(Math.floor(seconds / 3600))}h ${pad(Math.floor(seconds / 60) % 60)}m ${pad(seconds % 60)}s`,
      dec: `${hash[8] % 2 ? '+' : '−'}${pad(Math.floor(decSeconds / 3600))}° ${pad(Math.floor(decSeconds / 60) % 60)}′ ${pad(decSeconds % 60)}″`,
    },
    constellation: constellations[hash[9] % constellations.length],
    distance: 40 + (hash.readUInt16BE(10) % 1960),
  };
}

/** Local persistent storage: deploy on a persistent volume, or replace with a managed database. */
function storePath(): string {
  return path.join(process.env.STAR_DATA_DIR || path.join(process.cwd(), 'data'), 'stars.json');
}

async function readStore(): Promise<Store> {
  try {
    const store: unknown = JSON.parse(await readFile(storePath(), 'utf8'));
    if (!store || typeof store !== 'object' || (store as Store).version !== 1 || !Array.isArray((store as Store).stars)) {
      throw new Error('The star registry data is invalid.');
    }
    return store as Store;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, stars: [] };
    throw error;
  }
}

function publicStar(star: StoredStar): Star {
  const { email: _privateEmail, ...safe } = star;
  return safe;
}

// Reuse the queue across development hot reloads. Serializes read-modify-write operations.
const globalStore = globalThis as typeof globalThis & { starWriteQueue?: Promise<unknown> };
export async function createStar(value: unknown): Promise<Star> {
  const input = validateStarInput(value);
  const id = randomUUID();
  const star: StoredStar = {
    ...input,
    id,
    code: `AST-${randomBytes(4).toString('hex').toUpperCase()}`,
    createdAt: new Date().toISOString(),
    ...celestialDetails(id),
  };
  const pending = (globalStore.starWriteQueue ?? Promise.resolve()).then(async () => {
    const store = await readStore();
    while (store.stars.some(existing => existing.code === star.code)) {
      star.code = `AST-${randomBytes(4).toString('hex').toUpperCase()}`;
    }
    store.stars.push(star);
    const filename = storePath();
    await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
    const temporary = `${filename}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, filename);
    return publicStar(star);
  });
  globalStore.starWriteQueue = pending.catch(() => undefined);
  return pending;
}

export async function getStar(id: string): Promise<Star | null> {
  if (id === 'demo') return {
    id: 'demo', code: 'AST-DEMO', starName: 'Amelia', recipientName: 'Amelia',
    senderName: 'Someone who loves you',
    dedication: 'In a sky full of stars, you will always be my favorite. Here is a little piece of forever, just for you.',
    occasion: 'Just because', dedicationDate: '2026-11-08', createdAt: '2026-11-08T12:00:00.000Z',
    coordinates: { ra: '18h 36m 56s', dec: '+38° 47′ 01″' }, constellation: 'Lyra', distance: 25,
  };
  const isCode = /^AST-[0-9a-f]{8}$/i.test(id);
  if (!isCode && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
  await globalStore.starWriteQueue;
  const star = (await readStore()).stars.find(item => isCode ? item.code === id.toUpperCase() : item.id === id.toLowerCase());
  return star ? publicStar(star) : null;
}
