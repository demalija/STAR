import { createHash, randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { atomicJson, dataDirectory, getDatabase, readJson, serializedFile, waitForFile } from './storage';

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
  updatedAt: string;
  status: StarStatus;
  coordinates: { ra: string; dec: string };
  constellation: string;
  /** Illustrative distance in light years, not an astronomical catalog record. */
  distance: number;
}

export type StarStatus = 'published' | 'draft' | 'archived';
export interface AdminStar extends Star { email?: string }
type StoredStar = AdminStar;
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

function storePath(): string { return path.join(dataDirectory(), 'stars.json'); }

function normalizeStar(value: StoredStar): StoredStar {
  return { ...value, status: value.status ?? 'published', updatedAt: value.updatedAt ?? value.createdAt };
}

async function readStore(): Promise<Store> {
  const store = await readJson<Store>(storePath(), { version: 1, stars: [] });
  if (!store || store.version !== 1 || !Array.isArray(store.stars)) throw new Error('The star registry data is invalid.');
  return { ...store, stars: store.stars.map(normalizeStar) };
}

function publicStar(star: StoredStar): Star {
  const { email: _privateEmail, ...safe } = star;
  return safe;
}

function validStatus(value: unknown): StarStatus {
  if (value === undefined) return 'published';
  if (typeof value !== 'string' || !['published', 'draft', 'archived'].includes(value)) throw new ValidationError({ status: 'Choose published, draft, or archived.' });
  return value as StarStatus;
}

function makeStar(value: unknown, admin: boolean): StoredStar {
  const input = validateStarInput(value);
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  return { ...input, id, code: `AST-${randomBytes(8).toString('hex').toUpperCase()}`, createdAt: timestamp,
    updatedAt: timestamp, status: admin ? validStatus((value as Record<string, unknown>).status) : 'published', ...celestialDetails(id) };
}

async function saveNewStar(value: unknown, admin: boolean): Promise<StoredStar> {
  const star = makeStar(value, admin);
  const sql = await getDatabase();
  if (sql) {
    // The UNIQUE database constraint resolves collisions even across application instances.
    for (let attempt = 0; attempt < 8; attempt++) {
      if (attempt) star.code = `AST-${randomBytes(8).toString('hex').toUpperCase()}`;
      const rows = await sql`INSERT INTO asteria_stars (id,code,data) VALUES (${star.id},${star.code},${sql.json(star as never)}) ON CONFLICT (code) DO NOTHING RETURNING id`;
      if (rows.length) return star;
    }
    throw new Error('Unable to allocate a unique gift code. Please try again.');
  }
  return serializedFile(storePath(), async () => {
    const store = await readStore();
    while (store.stars.some(existing => existing.code === star.code)) star.code = `AST-${randomBytes(8).toString('hex').toUpperCase()}`;
    store.stars.push(star);
    await atomicJson(storePath(), store);
    return star;
  });
}

export async function createStar(value: unknown): Promise<Star> { return publicStar(await saveNewStar(value, false)); }
export async function createAdminStar(value: unknown): Promise<AdminStar> { return saveNewStar(value, true); }

const demoStar: Star = {
  id: 'demo', code: 'AST-DEMO', starName: 'Amelia', recipientName: 'Amelia', senderName: 'Someone who loves you',
  dedication: 'In a sky full of stars, you will always be my favorite. Here is a little piece of forever, just for you.',
  occasion: 'Just because', dedicationDate: '2026-11-08', createdAt: '2026-11-08T12:00:00.000Z', updatedAt: '2026-11-08T12:00:00.000Z', status: 'published',
  coordinates: { ra: '18h 36m 56s', dec: '+38° 47′ 01″' }, constellation: 'Lyra', distance: 25,
};

export async function getAdminStar(id: string): Promise<AdminStar | null> {
  const isCode = /^AST-[0-9a-f]{8}(?:[0-9a-f]{8})?$/i.test(id);
  if (!isCode && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
  const sql = await getDatabase();
  if (sql) {
    const rows = isCode ? await sql`SELECT data FROM asteria_stars WHERE code = ${id.toUpperCase()}` : await sql`SELECT data FROM asteria_stars WHERE id = ${id.toLowerCase()}`;
    return rows.length ? normalizeStar(rows[0].data as StoredStar) : null;
  }
  await waitForFile(storePath());
  return (await readStore()).stars.find(item => isCode ? item.code === id.toUpperCase() : item.id === id.toLowerCase()) ?? null;
}

export async function getStar(id: string): Promise<Star | null> {
  if (id === 'demo') return structuredClone(demoStar);
  const star = await getAdminStar(id);
  return star?.status === 'published' ? publicStar(star) : null;
}

export interface StarListOptions { search?: string; status?: string; page?: number; limit?: number }
export interface StarList { stars: AdminStar[]; total: number; page: number; pages: number }

export async function listStars(options: StarListOptions = {}): Promise<StarList> {
  const rawPage = Number(options.page);
  const rawLimit = Number(options.limit);
  const page = Number.isFinite(rawPage) ? Math.min(1_000_000, Math.max(1, Math.floor(rawPage) || 1)) : 1;
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit) || 20)) : 20;
  const search = (options.search ?? '').trim().slice(0, 200).toLowerCase();
  const status = ['published', 'draft', 'archived'].includes(options.status ?? '') ? options.status! : '';
  const sql = await getDatabase();
  let stars: AdminStar[];
  let total: number;
  if (sql) {
    // position() treats user '%' and '_' characters literally, unlike an unescaped LIKE.
    const filter = sql`(${status} = '' OR COALESCE(data->>'status','published') = ${status}) AND (${search} = '' OR position(${search} in lower(concat_ws(' ',data->>'starName',data->>'recipientName',data->>'senderName',data->>'email',code))) > 0)`;
    const counts = await sql`SELECT count(*)::int AS total FROM asteria_stars WHERE ${filter}`;
    total = counts[0].total;
    const rows = await sql`SELECT data FROM asteria_stars WHERE ${filter} ORDER BY data->>'createdAt' DESC, id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
    stars = rows.map(row => normalizeStar(row.data as StoredStar));
  } else {
    await waitForFile(storePath());
    const all = (await readStore()).stars.filter(star => (!status || star.status === status) && (!search || [star.starName,star.recipientName,star.senderName,star.email,star.code].filter(Boolean).join(' ').toLowerCase().includes(search)))
      .sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    total = all.length;
    stars = all.slice((page - 1) * limit, page * limit);
  }
  return { stars, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

function mergeUpdate(star: StoredStar, value: unknown): StoredStar {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError({ form: 'Provide the dedication changes.' });
  const fields = value as Record<string, unknown>;
  const input = validateStarInput({ ...star, ...fields });
  // Explicitly retain immutable identity and celestial data. Ignore arbitrary client properties.
  const { email: _oldEmail, ...original } = star;
  return { ...original, ...input, status: validStatus(Object.hasOwn(fields, 'status') ? fields.status : star.status), updatedAt: new Date().toISOString() };
}

export async function updateStar(id: string, value: unknown): Promise<AdminStar | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sql = await getDatabase();
  if (sql) {
    const result = await sql.begin(async tx => {
      const rows = await tx`SELECT data FROM asteria_stars WHERE id = ${id} FOR UPDATE`;
      if (!rows.length) return null;
      const star = mergeUpdate(normalizeStar(rows[0].data as StoredStar), value);
      await tx`UPDATE asteria_stars SET data = ${tx.json(star as never)} WHERE id = ${id}`;
      return star;
    });
    return result as AdminStar | null;
  }
  return serializedFile(storePath(), async () => {
    const store = await readStore();
    const index = store.stars.findIndex(star => star.id === id);
    if (index < 0) return null;
    store.stars[index] = mergeUpdate(store.stars[index], value);
    await atomicJson(storePath(), store);
    return store.stars[index];
  });
}

export async function deleteStar(id: string): Promise<boolean> {
  const sql = await getDatabase();
  if (sql) return (await sql`DELETE FROM asteria_stars WHERE id = ${id} RETURNING id`).length > 0;
  return serializedFile(storePath(), async () => {
    const store = await readStore();
    const remaining = store.stars.filter(star => star.id !== id);
    if (remaining.length === store.stars.length) return false;
    await atomicJson(storePath(), { ...store, stars: remaining });
    return true;
  });
}

export async function getOverview() {
  const sql = await getDatabase();
  const days = Array.from({ length: 14 }, (_, index) => { const day = new Date(); day.setUTCDate(day.getUTCDate() - 13 + index); return day.toISOString().slice(0,10); });
  if (sql) {
    const [counts, recent, dayRows, occasionRows] = await Promise.all([
      sql`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE COALESCE(data->>'status','published')='published')::int AS published,
        count(*) FILTER (WHERE data->>'status'='draft')::int AS draft,
        count(*) FILTER (WHERE data->>'status'='archived')::int AS archived FROM asteria_stars`,
      sql`SELECT data FROM asteria_stars ORDER BY data->>'createdAt' DESC LIMIT 5`,
      sql`SELECT left(data->>'createdAt',10) AS date, count(*)::int AS count FROM asteria_stars WHERE data->>'createdAt' >= ${days[0]} GROUP BY 1`,
      sql`SELECT data->>'occasion' AS name, count(*)::int AS count FROM asteria_stars GROUP BY 1 ORDER BY count DESC`,
    ]);
    const totals = counts[0];
    return { total: Number(totals.total), published: Number(totals.published), draft: Number(totals.draft), archived: Number(totals.archived),
      recent: recent.map(row => publicStar(normalizeStar(row.data as StoredStar))),
      daily: days.map(date => ({ date, count: Number(dayRows.find(row=>row.date===date)?.count ?? 0) })),
      occasions: occasionRows.map(row=>({ name: String(row.name ?? 'Just because'), count: Number(row.count) })) };
  }
  await waitForFile(storePath());
  const stars = (await readStore()).stars;
  const dayCounts = new Map<string, number>();
  const occasionCounts = new Map<string, number>();
  for (const star of stars) {
    const day = star.createdAt.slice(0,10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    occasionCounts.set(star.occasion, (occasionCounts.get(star.occasion) ?? 0) + 1);
  }
  return { total: stars.length, published: stars.filter(star=>star.status==='published').length, draft: stars.filter(star=>star.status==='draft').length,
    archived: stars.filter(star=>star.status==='archived').length, recent: [...stars].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5).map(publicStar),
    daily: days.map(date=>({date,count:dayCounts.get(date)??0})), occasions: [...occasionCounts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count) };
}

/** Explicit one-way import. Existing PostgreSQL IDs/codes are preserved and never overwritten. */
export async function migrateLocalData() {
  const sql = await getDatabase();
  if (!sql) throw new Error('Set DATABASE_URL before importing local records.');
  const store = await readStore();
  let imported = 0;
  for (const star of store.stars) {
    const rows = await sql`INSERT INTO asteria_stars (id,code,data) VALUES (${star.id},${star.code},${sql.json(star as never)}) ON CONFLICT DO NOTHING RETURNING id`;
    imported += rows.length;
  }
  const documents = await readJson<Record<string, unknown>>(path.join(dataDirectory(),'settings.json'), {});
  let settingsImported = 0;
  for (const [key,value] of Object.entries(documents)) {
    const rows = await sql`INSERT INTO asteria_documents (key,data) VALUES (${key},${sql.json(value as never)}) ON CONFLICT DO NOTHING RETURNING key`;
    settingsImported += rows.length;
  }
  return { imported, skipped: store.stars.length - imported, settingsImported };
}
