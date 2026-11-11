import { PGlite } from "@electric-sql/pglite";
import {
  mkdir,
  readFile,
  open,
  rename,
  copyFile,
  access,
} from "node:fs/promises";
import { join } from "node:path";
import lockfile from "proper-lockfile";

export async function openDatabase(path?: string) {
  let release: (() => Promise<void>) | undefined;
  let snapshot: string | undefined;
  let initial: Blob | undefined;
  if (path) {
    await mkdir(path, { recursive: true });
    // Never reinterpret or modify the legacy PostgreSQL directory as a new store.
    try {
      await access(join(path, "PG_VERSION"));
      throw new Error(
        "This is a legacy PostgreSQL data directory. Preserve it and use DATABASE_PATH=./data/snapshots for the new snapshot store.",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    try {
      release = await lockfile.lock(path, {
        realpath: false,
        stale: 10000,
        update: 2000,
        retries: 0,
      });
    } catch {
      throw new Error(
        "Database is in use by another app process. Stop the previous instance; after an abrupt stop, wait 10 seconds before restarting.",
      );
    }
    snapshot = join(path, "database.tar.gz");
    try {
      initial = new Blob([await readFile(snapshot)]);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        await release();
        throw error;
      }
    }
  }
  const db = new PGlite(initial ? { loadDataDir: initial } : {});
  async function save() {
    if (!snapshot) return;
    const bytes = new Uint8Array(
      await (await db.dumpDataDir("gzip")).arrayBuffer(),
    );
    const handle = await open(snapshot + ".tmp", "w", 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await copyFile(snapshot, snapshot + ".previous");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await rename(snapshot + ".tmp", snapshot);
  }
  try {
    await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('freelancer','client')),
      bio TEXT NOT NULL DEFAULT '', skills JSONB NOT NULL DEFAULT '[]',
      experience TEXT NOT NULL DEFAULT '', portfolio TEXT NOT NULL DEFAULT '',
      organization TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id UUID PRIMARY KEY, client_id UUID NOT NULL REFERENCES users(id),
      title TEXT NOT NULL, description TEXT NOT NULL, required_skills JSONB NOT NULL,
      category TEXT NOT NULL, budget NUMERIC(12,2) NOT NULL CHECK(budget > 0),
      status TEXT NOT NULL CHECK(status IN ('open','in_progress','closed')) DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS jobs_client_idx ON jobs(client_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  `);
    if (!initial) await save();
  } catch (error) {
    if (!db.closed) await db.close().catch(() => {});
    await release?.();
    throw new Error(
      "Database startup failed. Existing snapshots were preserved; no automatic reset was performed.",
      { cause: error },
    );
  }
  let queue: Promise<unknown> = Promise.resolve();
  let closing = false;
  let storageError: unknown;
  return {
    get closed() {
      return db.closed;
    },
    query<T>(sql: string, params?: unknown[]) {
      if (closing) return Promise.reject(new Error("Database is closing"));
      const result = queue.then(async () => {
        if (storageError)
          throw new Error(
            "Database persistence failed; restart the API before continuing.",
          );
        const response = await db.query<T>(sql, params);
        if (!/^\s*(SELECT|SHOW|EXPLAIN)\b/i.test(sql)) {
          try {
            await save();
          } catch (error) {
            storageError = error;
            throw error;
          }
        }
        return response;
      });
      queue = result.catch(() => {});
      return result;
    },
    async close() {
      closing = true;
      await queue;
      try {
        if (!db.closed) await db.close();
      } finally {
        await release?.();
      }
    },
  };
}
export type Database = Awaited<ReturnType<typeof openDatabase>>;
