import type { MuscleGroup, Exercise, ExerciseMuscle, Session, Set } from "../lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = { sqlite3: any; db: number };

/** Run a SQL query and return rows as typed objects */
async function query<T = Record<string, unknown>>(
  db: DB,
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const results: T[] = [];
  if (params && params.length > 0) {
    // Use prepared statement for parameterized queries
    const str = db.sqlite3.str_new(db.db, sql);
    const prepared = await db.sqlite3.prepare_v2(db.db, db.sqlite3.str_value(str));
    if (prepared === null) {
      db.sqlite3.str_finish(str);
      return results;
    }
    const stmt = prepared.stmt;
    try {
      for (let i = 0; i < params.length; i++) {
        const val = params[i];
        if (val === null || val === undefined) {
          db.sqlite3.bind(stmt, i + 1, null);
        } else if (typeof val === "number") {
          db.sqlite3.bind(stmt, i + 1, val);
        } else {
          db.sqlite3.bind(stmt, i + 1, String(val));
        }
      }
      const cols = db.sqlite3.column_names(stmt);
      while ((await db.sqlite3.step(stmt)) === 100 /* SQLITE_ROW */) {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < cols.length; i++) {
          obj[cols[i]] = db.sqlite3.column(stmt, i);
        }
        results.push(obj as T);
      }
    } finally {
      await db.sqlite3.finalize(stmt);
      db.sqlite3.str_finish(str);
    }
  } else {
    // Simple exec for non-parameterized queries
    await db.sqlite3.exec(db.db, sql, (row: unknown[], columns: string[]) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      results.push(obj as T);
    });
  }
  return results;
}

/** Run a SQL statement (no results needed) */
async function run(db: DB, sql: string, params?: unknown[]): Promise<void> {
  if (params && params.length > 0) {
    const str = db.sqlite3.str_new(db.db, sql);
    const prepared = await db.sqlite3.prepare_v2(db.db, db.sqlite3.str_value(str));
    if (prepared === null) {
      db.sqlite3.str_finish(str);
      return;
    }
    const stmt = prepared.stmt;
    try {
      for (let i = 0; i < params.length; i++) {
        const val = params[i];
        if (val === null || val === undefined) {
          db.sqlite3.bind(stmt, i + 1, null);
        } else if (typeof val === "number") {
          db.sqlite3.bind(stmt, i + 1, val);
        } else {
          db.sqlite3.bind(stmt, i + 1, String(val));
        }
      }
      await db.sqlite3.step(stmt);
    } finally {
      await db.sqlite3.finalize(stmt);
      db.sqlite3.str_finish(str);
    }
  } else {
    await db.sqlite3.exec(db.db, sql);
  }
}

// ── Sessions ──────────────────────────────────────────────

export async function createSession(db: DB, date: string): Promise<Session> {
  const id = crypto.randomUUID();
  const started_at = new Date().toISOString();
  await run(db, `INSERT INTO sessions (id, date, started_at) VALUES (?, ?, ?)`, [id, date, started_at]);
  return { id, date, started_at, notes: null };
}

export async function getRecentSessions(db: DB, limit: number = 10): Promise<Session[]> {
  return query<Session>(db, `SELECT * FROM sessions ORDER BY date DESC LIMIT ${limit}`);
}

export async function getSession(db: DB, id: string): Promise<Session | null> {
  const rows = await query<Session>(db, `SELECT * FROM sessions WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

export async function deleteSession(db: DB, id: string): Promise<void> {
  await run(db, `DELETE FROM sets WHERE session_id = ?`, [id]);
  await run(db, `DELETE FROM sessions WHERE id = ?`, [id]);
}

// ── Exercises ─────────────────────────────────────────────

export async function createExercise(
  db: DB,
  exercise: Omit<Exercise, "id" | "display_name"> & { display_name?: string }
): Promise<Exercise> {
  const parts = [exercise.position, exercise.equipment, exercise.target, exercise.angle, exercise.movement]
    .filter(Boolean);
  const display_name = exercise.display_name || parts.join(" · ");
  const id = display_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await run(
    db,
    `INSERT OR IGNORE INTO exercises (id, position, equipment, target, angle, movement, variant, display_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, exercise.position, exercise.equipment, exercise.target, exercise.angle ?? null, exercise.movement, exercise.variant ?? null, display_name]
  );
  return { id, ...exercise, display_name, angle: exercise.angle ?? null, variant: exercise.variant ?? null };
}

export async function searchExercises(db: DB, q: string): Promise<Exercise[]> {
  if (!q.trim()) return getAllExercises(db);
  const pattern = `%${q}%`;
  return query<Exercise>(db, `SELECT * FROM exercises WHERE display_name LIKE ? ORDER BY display_name`, [pattern]);
}

export async function getAllExercises(db: DB): Promise<Exercise[]> {
  return query<Exercise>(db, `SELECT * FROM exercises ORDER BY display_name`);
}

export async function getExercise(db: DB, id: string): Promise<Exercise | null> {
  const rows = await query<Exercise>(db, `SELECT * FROM exercises WHERE id = ?`, [id]);
  return rows[0] ?? null;
}

// ── Exercise Muscles ──────────────────────────────────────

export async function setExerciseMuscles(
  db: DB,
  exerciseId: string,
  muscles: { muscleGroupId: string; weight: number }[]
): Promise<void> {
  await run(db, `DELETE FROM exercise_muscles WHERE exercise_id = ?`, [exerciseId]);
  for (const m of muscles) {
    await run(
      db,
      `INSERT INTO exercise_muscles (exercise_id, muscle_group_id, weight) VALUES (?, ?, ?)`,
      [exerciseId, m.muscleGroupId, m.weight]
    );
  }
}

export async function getExerciseMuscles(db: DB, exerciseId: string): Promise<ExerciseMuscle[]> {
  return query<ExerciseMuscle>(db, `SELECT * FROM exercise_muscles WHERE exercise_id = ?`, [exerciseId]);
}

// ── Sets ──────────────────────────────────────────────────

export async function addSet(db: DB, set: Omit<Set, "id">): Promise<Set> {
  const id = crypto.randomUUID();
  await run(
    db,
    `INSERT INTO sets (id, session_id, exercise_id, set_order, weight, reps, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, set.session_id, set.exercise_id, set.set_order, set.weight, set.reps, set.notes ?? null]
  );
  return { id, ...set };
}

export async function updateSet(db: DB, id: string, updates: Partial<Pick<Set, "weight" | "reps" | "notes">>): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (updates.weight !== undefined) { fields.push("weight = ?"); values.push(updates.weight); }
  if (updates.reps !== undefined) { fields.push("reps = ?"); values.push(updates.reps); }
  if (updates.notes !== undefined) { fields.push("notes = ?"); values.push(updates.notes); }
  if (fields.length === 0) return;
  values.push(id);
  await run(db, `UPDATE sets SET ${fields.join(", ")} WHERE id = ?`, values);
}

export async function deleteSet(db: DB, id: string): Promise<void> {
  await run(db, `DELETE FROM sets WHERE id = ?`, [id]);
}

export async function getSetsForSession(db: DB, sessionId: string): Promise<Set[]> {
  return query<Set>(db, `SELECT * FROM sets WHERE session_id = ? ORDER BY exercise_id, set_order`, [sessionId]);
}

export async function getLastSetsForExercise(
  db: DB,
  exerciseId: string
): Promise<{ date: string; sets: Set[] } | null> {
  // Find the most recent session that has sets for this exercise
  const sessions = await query<{ session_id: string; date: string }>(
    db,
    `SELECT DISTINCT s.id as session_id, s.date
     FROM sessions s
     JOIN sets st ON st.session_id = s.id
     WHERE st.exercise_id = ?
     ORDER BY s.date DESC
     LIMIT 1`,
    [exerciseId]
  );
  if (sessions.length === 0) return null;
  const { session_id, date } = sessions[0];
  const sets = await query<Set>(
    db,
    `SELECT * FROM sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_order`,
    [session_id, exerciseId]
  );
  return { date, sets };
}

// ── Muscle Groups ─────────────────────────────────────────

export async function getAllMuscleGroups(db: DB): Promise<MuscleGroup[]> {
  return query<MuscleGroup>(db, `SELECT * FROM muscle_groups ORDER BY name`);
}

// ── Stats ─────────────────────────────────────────────────

export async function getWeekStats(db: DB): Promise<{ sessionCount: number; setCount: number }> {
  // Get Monday of current week
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const mondayStr = monday.toISOString().split("T")[0];

  const sessionRows = await query<{ cnt: number }>(
    db,
    `SELECT COUNT(*) as cnt FROM sessions WHERE date >= ?`,
    [mondayStr]
  );
  const setRows = await query<{ cnt: number }>(
    db,
    `SELECT COUNT(*) as cnt FROM sets WHERE session_id IN (SELECT id FROM sessions WHERE date >= ?)`,
    [mondayStr]
  );
  return {
    sessionCount: sessionRows[0]?.cnt ?? 0,
    setCount: setRows[0]?.cnt ?? 0,
  };
}

export async function getSessionExerciseCount(db: DB, sessionId: string): Promise<number> {
  const rows = await query<{ cnt: number }>(
    db,
    `SELECT COUNT(DISTINCT exercise_id) as cnt FROM sets WHERE session_id = ?`,
    [sessionId]
  );
  return rows[0]?.cnt ?? 0;
}
