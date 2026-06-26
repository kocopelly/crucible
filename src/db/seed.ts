// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = { sqlite3: any; db: number };

const MUSCLE_GROUPS: [string, string, string | null][] = [
  ["back", "Back", null],
  ["upper-back", "Upper Back", "back"],
  ["mid-back", "Mid Back", "back"],
  ["lower-back", "Lower Back", "back"],
  ["shoulder", "Shoulder", null],
  ["front-delt", "Front Delt", "shoulder"],
  ["side-delt", "Side Delt", "shoulder"],
  ["rear-delt", "Rear Delt", "shoulder"],
  ["chest", "Chest", null],
  ["upper-chest", "Upper Chest", "chest"],
  ["lower-chest", "Lower Chest", "chest"],
  ["quad", "Quad", null],
  ["hamstring", "Hamstring", null],
  ["glute", "Glute", null],
  ["calf", "Calf", null],
  ["adductor", "Adductor", null],
  ["bicep", "Bicep", null],
  ["tricep", "Tricep", null],
  ["forearm", "Forearm", null],
  ["core", "Core", null],
  ["abs", "Abs", "core"],
  ["obliques", "Obliques", "core"],
  ["traps", "Traps", null],
];

export async function seedMuscleGroups(db: DB): Promise<void> {
  for (const [id, name, parent] of MUSCLE_GROUPS) {
    const parentVal = parent ? `'${parent}'` : "NULL";
    await db.sqlite3.exec(
      db.db,
      `INSERT OR IGNORE INTO muscle_groups (id, name, parent) VALUES ('${id}', '${name}', ${parentVal});`
    );
  }
}
