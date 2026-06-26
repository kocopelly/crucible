import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import { Factory } from "wa-sqlite";
import { IDBBatchAtomicVFS } from "wa-sqlite/src/examples/IDBBatchAtomicVFS.js";
import { MemoryVFS } from "wa-sqlite/src/examples/MemoryVFS.js";
import { seedMuscleGroups } from "./seed";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS muscle_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent TEXT,
  FOREIGN KEY (parent) REFERENCES muscle_groups(id)
);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  position TEXT NOT NULL,
  equipment TEXT NOT NULL,
  target TEXT NOT NULL,
  angle TEXT,
  movement TEXT NOT NULL,
  variant TEXT,
  display_name TEXT NOT NULL,
  FOREIGN KEY (target) REFERENCES muscle_groups(id)
);

CREATE TABLE IF NOT EXISTS exercise_muscles (
  exercise_id TEXT NOT NULL,
  muscle_group_id TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY (exercise_id, muscle_group_id),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id),
  FOREIGN KEY (muscle_group_id) REFERENCES muscle_groups(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  set_order INTEGER NOT NULL,
  weight REAL NOT NULL,
  reps INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: { sqlite3: any; db: number } | null = null;

export async function getDB() {
  if (_db) return _db;

  const module = await SQLiteESMFactory();
  const sqlite3 = Factory(module);

  let db: number;

  try {
    // IDBBatchAtomicVFS — persists to IndexedDB
    // Note: journal "file not found" errors in console are expected and harmless.
    // SQLite probes for the journal; CANTOPEN tells it no hot journal exists.
    const vfs = new IDBBatchAtomicVFS("crucible-idb");
    sqlite3.vfs_register(vfs, true);
    db = await sqlite3.open_v2("crucible.db");
    console.log("[Crucible DB] Using IndexedDB persistence (IDBBatchAtomicVFS)");
  } catch (e) {
    console.warn("[Crucible DB] IDB VFS failed, falling back to in-memory:", e);
    try {
      const vfs = new MemoryVFS();
      sqlite3.vfs_register(vfs, true);
      db = await sqlite3.open_v2("crucible.db");
    } catch {
      db = await sqlite3.open_v2("crucible.db");
    }
    console.warn("[Crucible DB] Using in-memory database (data will not persist)");
  }

  // Execute full schema in one call — avoid multiple sequential transactions
  await sqlite3.exec(db, SCHEMA);

  _db = { sqlite3, db };

  // Seed data
  await seedMuscleGroups(_db);

  return _db;
}
