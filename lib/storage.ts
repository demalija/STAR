import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Sql } from 'postgres';

const shared = globalThis as typeof globalThis & {
  asteriaDatabases?: Map<string, Promise<Sql>>;
  asteriaFileQueues?: Map<string, Promise<unknown>>;
};

/** Vercel has an ephemeral filesystem: never silently accept gifts without a database. */
export function storageMode(): 'postgres' | 'local' {
  if (process.env.DATABASE_URL) return 'postgres';
  if (process.env.VERCEL) throw new Error('DATABASE_URL is required on Vercel. Configure a PostgreSQL database before accepting dedications.');
  return 'local';
}

export function dataDirectory(): string {
  return process.env.STAR_DATA_DIR || path.join(process.cwd(), 'data');
}

export async function getDatabase(): Promise<Sql | null> {
  if (storageMode() === 'local') return null;
  const url = process.env.DATABASE_URL!;
  shared.asteriaDatabases ??= new Map();
  let database = shared.asteriaDatabases.get(url);
  if (!database) {
    database = (async () => {
      const { default: postgres } = await import('postgres');
      const host = new URL(url).hostname;
      const sql = postgres(url, {
        max: 5, prepare: false, idle_timeout: 20, connect_timeout: 10,
        ssl: ['localhost', '127.0.0.1', '[::1]'].includes(host) ? false : { rejectUnauthorized: true },
      });
      try {
        // PostgreSQL catalog creation can race even with IF NOT EXISTS. Serialize schema
        // initialization across cold application instances, releasing the lock on commit.
        await sql.begin(async tx => {
          await tx`SELECT pg_advisory_xact_lock(914207230, 1)`;
          await tx`CREATE TABLE IF NOT EXISTS asteria_stars (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, data JSONB NOT NULL)`;
          await tx`CREATE INDEX IF NOT EXISTS asteria_stars_created_at ON asteria_stars ((data->>'createdAt'))`;
          await tx`CREATE TABLE IF NOT EXISTS asteria_documents (key TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
        });
        return sql;
      } catch (error) {
        await sql.end({ timeout: 5 });
        throw error;
      }
    })();
    shared.asteriaDatabases.set(url, database);
    void database.catch(() => shared.asteriaDatabases?.delete(url));
  }
  return database;
}

export async function readJson<T>(filename: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(filename, 'utf8')) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return structuredClone(fallback);
    throw error;
  }
}

export async function atomicJson(filename: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, filename);
}

export async function serializedFile<T>(filename: string, task: () => Promise<T>): Promise<T> {
  shared.asteriaFileQueues ??= new Map();
  const pending = (shared.asteriaFileQueues.get(filename) ?? Promise.resolve()).then(task);
  shared.asteriaFileQueues.set(filename, pending.catch(() => undefined));
  return pending;
}

export async function waitForFile(filename: string): Promise<void> {
  await shared.asteriaFileQueues?.get(filename);
}

function checkKey(key: string) {
  if (!/^[a-z0-9][a-z0-9:_-]{0,99}$/i.test(key)) throw new Error('Invalid document key.');
}

export async function readDocument<T>(key: string, fallback: T): Promise<T> {
  checkKey(key);
  const sql = await getDatabase();
  if (sql) {
    const rows = await sql`SELECT data FROM asteria_documents WHERE key = ${key}`;
    return rows.length ? rows[0].data as T : structuredClone(fallback);
  }
  const filename = path.join(dataDirectory(), 'settings.json');
  await waitForFile(filename);
  const documents = await readJson<Record<string, unknown>>(filename, {});
  return Object.hasOwn(documents, key) ? documents[key] as T : structuredClone(fallback);
}

export async function writeDocument<T>(key: string, value: T): Promise<void> {
  checkKey(key);
  const sql = await getDatabase();
  if (sql) {
    await sql`INSERT INTO asteria_documents (key,data) VALUES (${key},${sql.json(value as never)}) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`;
    return;
  }
  const filename = path.join(dataDirectory(), 'settings.json');
  await serializedFile(filename, async () => {
    const documents = await readJson<Record<string, unknown>>(filename, {});
    documents[key] = value;
    await atomicJson(filename, documents);
  });
}

export async function closeDatabase(): Promise<void> {
  const databases = [...shared.asteriaDatabases?.values() ?? []];
  shared.asteriaDatabases?.clear();
  await Promise.all(databases.map(async database => (await database).end({ timeout: 5 })));
}
