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

const STORAGE_KEY = "crucible-db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DBInstance = { sqlite3: any; db: number };
let _db: DBInstance | null = null;
let _initPromise: Promise<DBInstance> | null = null;

export async function getDB(): Promise<DBInstance> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;
  _initPromise = _initDB();
  return _initPromise;
}

async function _initDB(): Promise<DBInstance> {
  const module = await SQLiteESMFactory();
  const sqlite3 = Factory(module);

  const vfs = new MemoryVFS();
  sqlite3.vfs_register(vfs, true);
  const db = await sqlite3.open_v2("crucible.db");

  // Try to restore from localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const bytes = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
      // Import the database by writing to the VFS file
      const importSQL = _buildImportSQL(bytes, sqlite3, db);
      if (importSQL) {
        // Can't directly restore bytes to MemoryVFS, so we use a fresh approach:
        // Close and reopen with the data
        await sqlite3.close(db);
        
        // Create a new DB and import via SQL dump stored separately
        const db2 = await sqlite3.open_v2("crucible.db");
        const sqlDump = localStorage.getItem(STORAGE_KEY + "-sql");
        if (sqlDump) {
          await sqlite3.exec(db2, sqlDump);
          console.log("[Crucible DB] Restored from localStorage");
          const instance: DBInstance = { sqlite3, db: db2 };
          _db = instance;
          return instance;
        }
        // Fallback: fresh DB
        await sqlite3.exec(db2, SCHEMA);
        const instance: DBInstance = { sqlite3, db: db2 };
        await seedMuscleGroups(instance);
        _db = instance;
        return instance;
      }
    } catch (e) {
      console.warn("[Crucible DB] Failed to restore from localStorage:", e);
    }
  }

  // Fresh DB
  await sqlite3.exec(db, SCHEMA);
  console.log("[Crucible DB] Created fresh database");

  const instance: DBInstance = { sqlite3, db };
  await seedMuscleGroups(instance);
  _db = instance;
  return instance;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _buildImportSQL(_bytes: Uint8Array, _sqlite3: any, _db: number): boolean {
  // MemoryVFS doesn't support direct byte import
  // We use SQL dump approach instead
  return false;
}

/** Save the database to localStorage as a SQL dump */
export async function saveDB(): Promise<void> {
  if (!_db) return;
  
  try {
    // Generate a SQL dump of all data
    const tables = ["muscle_groups", "exercises", "exercise_muscles", "sessions", "sets"];
    let sql = SCHEMA + "\n";
    
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
        const vals = cols.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return "NULL";
          if (typeof v === "number") return String(v);
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        sql += `INSERT OR REPLACE INTO ${table} (${cols.join(",")}) VALUES (${vals.join(",")});\n`;
      }
    }
    
    localStorage.setItem(STORAGE_KEY + "-sql", sql);
    console.log("[Crucible DB] Saved to localStorage");
  } catch (e) {
    console.warn("[Crucible DB] Save failed:", e);
  }
}
