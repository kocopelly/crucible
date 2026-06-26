import SQLiteESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import { Factory } from "wa-sqlite";
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

const STORAGE_KEY = "crucible-db-sql";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DBInstance = { sqlite3: any; db: number };
let _db: DBInstance | null = null;
let _initPromise: Promise<DBInstance> | null = null;
let _initCount = 0;

export async function getDB(): Promise<DBInstance> {
  console.log(`[DB] getDB called: _db=${!!_db}, _initPromise=${!!_initPromise}, count=${_initCount}`);
  if (_db) return _db;
  if (_initPromise) return _initPromise;
  _initCount++;
  _initPromise = _initDB();
  return _initPromise;
}

async function _initDB(): Promise<DBInstance> {
  const module = await SQLiteESMFactory();
  const sqlite3 = Factory(module);

  const vfs = new MemoryVFS();
  sqlite3.vfs_register(vfs, true);
  const db = await sqlite3.open_v2("crucible.db");

  // Always run schema first (CREATE IF NOT EXISTS is safe)
  await sqlite3.exec(db, SCHEMA);

  // Try to restore data from localStorage
  const sqlDump = localStorage.getItem(STORAGE_KEY);
  if (sqlDump) {
    try {
      await sqlite3.exec(db, sqlDump);
      console.log("[Crucible DB] Restored from localStorage");
    } catch (e) {
      console.warn("[Crucible DB] Restore failed, starting fresh:", e);
    }
  } else {
    console.log("[Crucible DB] Fresh database");
  }

  const instance: DBInstance = { sqlite3, db };

  // Seed muscle groups (INSERT OR IGNORE — safe to run on restored DB)
  await seedMuscleGroups(instance);

  _db = instance;
  return instance;
}

/** Save all data to localStorage as SQL INSERT statements */
export async function saveDB(): Promise<void> {
  if (!_db) return;

  try {
    const tables = ["muscle_groups", "exercises", "exercise_muscles", "sessions", "sets"];
    const statements: string[] = [];

    for (const table of tables) {
      const rows: Record<string, unknown>[] = [];
      await _db.sqlite3.exec(
        _db.db,
        `SELECT * FROM ${table}`,
        (row: unknown[], columns: string[]) => {
          const obj: Record<string, unknown> = {};
          columns.forEach((col, i) => { obj[col] = row[i]; });
          rows.push(obj);
        }
      );

      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = cols.map((c) => {
          const v = row[c];
          if (v === null || v === undefined) return "NULL";
          if (typeof v === "number") return String(v);
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        statements.push(
          `INSERT OR REPLACE INTO ${table} (${cols.join(",")}) VALUES (${vals.join(",")});`
        );
      }
    }

    localStorage.setItem(STORAGE_KEY, statements.join("\n"));
  } catch (e) {
    console.warn("[Crucible DB] Save failed:", e);
  }
}
