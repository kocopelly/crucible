import { createSignal, createEffect, createResource, For, Show, type Component } from "solid-js";
import { useDb } from "../db/context";
import {
  searchExercises,
  createExercise,
  setExerciseMuscles,
  getAllMuscleGroups,
} from "../db/queries";
import type { Exercise, MuscleGroup } from "../lib/types";

interface ExercisePickerProps {
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}

const POSITIONS = ["Standing", "Seated", "Lying", "Bent Over", "Kneeling"];
const EQUIPMENT = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "EZ Bar", "Band", "Smith"];
const ANGLES = ["", "Incline", "Decline"];
const MOVEMENTS = [
  "Press", "Curl", "Row", "Fly", "Raise", "Extension", "Pulldown",
  "Squat", "Deadlift", "Lunge", "Shrug", "Pullup", "Dip", "Crunch", "Kickback",
];

const ExercisePicker: Component<ExercisePickerProps> = (props) => {
  const { db } = useDb();
  const [mode, setMode] = createSignal<"search" | "create" | "muscles">("search");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [results, setResults] = createSignal<Exercise[]>([]);
  const [muscleGroupsData] = createResource(db, async (d) => {
    const groups = await getAllMuscleGroups(d);
    return groups;
  });
  const muscleGroups = () => muscleGroupsData() ?? [];

  // Create mode state
  const [position, setPosition] = createSignal(POSITIONS[0]);
  const [equipment, setEquipment] = createSignal(EQUIPMENT[0]);
  const [targetMuscle, setTargetMuscle] = createSignal("");
  const [angle, setAngle] = createSignal("");
  const [movement, setMovement] = createSignal(MOVEMENTS[0]);

  // Muscle assignment state
  const [createdExercise, setCreatedExercise] = createSignal<Exercise | null>(null);
  const [secondaryMuscles, setSecondaryMuscles] = createSignal<string[]>([]);
  const [error, setError] = createSignal("");

  // Set default target muscle when groups load
  createEffect(() => {
    const groups = muscleGroups();
    if (groups.length > 0 && !targetMuscle()) {
      const leaves = groups.filter((g) => !groups.some((c) => c.parent === g.id));
      setTargetMuscle(leaves.length > 0 ? leaves[0].id : groups[0].id);
    }
  });

  // Search as user types
  createEffect(() => {
    const d = db();
    if (!d || mode() !== "search") return;
    const q = searchQuery();
    searchExercises(d, q).then((found) => setResults(found));
  });

  const groupedMuscles = () => {
    const groups = muscleGroups();
    const parents = groups.filter((g) => !g.parent);
    return parents.map((p) => ({
      parent: p,
      children: groups.filter((g) => g.parent === p.id),
    }));
  };

  const flatMuscleOptions = () => {
    const opts: { id: string; name: string; indent: boolean }[] = [];
    for (const group of groupedMuscles()) {
      if (group.children.length > 0) {
        opts.push({ id: group.parent.id, name: `── ${group.parent.name} ──`, indent: false });
        for (const child of group.children) {
          opts.push({ id: child.id, name: child.name, indent: true });
        }
      } else {
        opts.push({ id: group.parent.id, name: group.parent.name, indent: false });
      }
    }
    return opts;
  };

  const generatedName = () => {
    const target = muscleGroups().find((m) => m.id === targetMuscle());
    const parts = [position(), equipment(), target?.name, angle(), movement()].filter(Boolean);
    return parts.join(" · ");
  };

  const handleCreate = async () => {
    const d = db();
    if (!d) return;
    const target = muscleGroups().find((m) => m.id === targetMuscle());
    if (!target) {
      setError("Please select a target muscle");
      return;
    }
    setError("");

    const exercise = await createExercise(d, {
      position: position(),
      equipment: equipment(),
      target: target.id,
      angle: angle() || null,
      movement: movement(),
      variant: null,
      display_name: generatedName(),
    });

    setCreatedExercise(exercise);
    setMode("muscles");
  };

  const handleFinishMuscles = async () => {
    const d = db();
    const exercise = createdExercise();
    if (!d || !exercise) return;

    const muscles = [
      { muscleGroupId: exercise.target, weight: 1.0 },
      ...secondaryMuscles().map((id) => ({ muscleGroupId: id, weight: 0.5 })),
    ];
    await setExerciseMuscles(d, exercise.id, muscles);
    props.onSelect(exercise);
  };

  const toggleSecondary = (id: string) => {
    setSecondaryMuscles((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  return (
    <div class="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class="bg-[#1a1a1a] w-full max-w-lg rounded-t-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-gray-700/50">
          <h2 class="text-lg font-bold">
            {mode() === "search" ? "Pick Exercise" : mode() === "create" ? "New Exercise" : "Muscle Groups"}
          </h2>
          <button onClick={props.onClose} class="text-gray-400 hover:text-white p-2">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          {/* Search Mode */}
          <Show when={mode() === "search"}>
            <input
              type="text"
              placeholder="Search exercises..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 mb-4 focus:outline-none focus:border-emerald-600"
              autofocus
            />
            <div class="space-y-2 mb-4">
              <For each={results()}>
                {(exercise) => (
                  <button
                    class="w-full text-left p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-emerald-600 transition-colors min-h-[44px]"
                    onClick={() => props.onSelect(exercise)}
                  >
                    <span class="text-gray-100">{exercise.display_name}</span>
                  </button>
                )}
              </For>
              <Show when={results().length === 0 && searchQuery()}>
                <p class="text-gray-500 text-sm text-center py-4">No exercises found</p>
              </Show>
            </div>
            <button
              class="w-full py-3 rounded-lg border-2 border-dashed border-gray-600 text-gray-400 hover:border-emerald-600 hover:text-emerald-400 transition-colors min-h-[44px]"
              onClick={() => setMode("create")}
            >
              + Create New Exercise
            </button>
          </Show>

          {/* Create Mode */}
          <Show when={mode() === "create"}>
            <div class="space-y-4">
              <SelectField label="Position" options={POSITIONS} value={position()} onChange={setPosition} />
              <SelectField label="Equipment" options={EQUIPMENT} value={equipment()} onChange={setEquipment} />

              <div>
                <label class="block text-xs text-gray-400 uppercase tracking-wide mb-1">Target Muscle</label>
                <select
                  class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 min-h-[44px] focus:outline-none focus:border-emerald-600"
                  value={targetMuscle()}
                  onChange={(e) => setTargetMuscle(e.currentTarget.value)}
                  ref={(el) => {
                    createEffect(() => {
                      const opts = flatMuscleOptions();
                      el.innerHTML = "";
                      for (const opt of opts) {
                        const o = document.createElement("option");
                        o.value = opt.id;
                        o.textContent = opt.indent ? `  ${opt.name}` : opt.name;
                        el.appendChild(o);
                      }
                      if (opts.length > 0 && !targetMuscle()) {
                        setTargetMuscle(opts[0].id);
                      }
                      if (targetMuscle()) {
                        el.value = targetMuscle();
                      }
                    });
                  }}
                >
                </select>
              </div>

              <SelectField label="Angle (optional)" options={ANGLES} value={angle()} onChange={setAngle} />
              <SelectField label="Movement" options={MOVEMENTS} value={movement()} onChange={setMovement} />

              <div class="rounded-lg bg-gray-800/50 border border-gray-700/50 p-3">
                <p class="text-xs text-gray-400 mb-1">Preview</p>
                <p class="text-emerald-400 font-medium">{generatedName()}</p>
              </div>

              <Show when={error()}>
                <p class="text-red-400 text-sm">{error()}</p>
              </Show>

              <div class="flex gap-3">
                <button
                  class="flex-1 py-3 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors min-h-[44px]"
                  onClick={() => setMode("search")}
                >
                  Back
                </button>
                <button
                  class="flex-1 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors min-h-[44px]"
                  onClick={handleCreate}
                >
                  Create
                </button>
              </div>
            </div>
          </Show>

          {/* Muscle Assignment Mode */}
          <Show when={mode() === "muscles"}>
            <div class="space-y-4">
              <div class="rounded-lg bg-gray-800/50 border border-gray-700/50 p-3">
                <p class="text-xs text-gray-400 mb-1">Exercise</p>
                <p class="text-emerald-400 font-medium">{createdExercise()?.display_name}</p>
              </div>

              <div>
                <p class="text-sm font-medium text-gray-300 mb-2">Primary Muscle</p>
                <div class="rounded-lg bg-emerald-600/20 border border-emerald-600/50 p-3">
                  <span class="text-emerald-400">
                    {muscleGroups().find((m) => m.id === createdExercise()?.target)?.name ?? "—"}
                  </span>
                  <span class="text-gray-500 text-sm ml-2">weight: 1.0</span>
                </div>
              </div>

              <div>
                <p class="text-sm font-medium text-gray-300 mb-2">Secondary Muscles (0.5)</p>
                <div class="space-y-1">
                  <For each={muscleGroups().filter((m) => m.id !== createdExercise()?.target)}>
                    {(mg) => (
                      <button
                        class={`w-full text-left p-2 rounded-lg text-sm min-h-[44px] transition-colors ${
                          secondaryMuscles().includes(mg.id)
                            ? "bg-emerald-600/20 border border-emerald-600/50 text-emerald-400"
                            : "bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-gray-200"
                        }`}
                        onClick={() => toggleSecondary(mg.id)}
                      >
                        {mg.parent ? "  " : ""}{mg.name}
                        <Show when={secondaryMuscles().includes(mg.id)}>
                          <span class="float-right">✓</span>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <button
                class="w-full py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors min-h-[44px]"
                onClick={handleFinishMuscles}
              >
                Done
              </button>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

// Reusable select field
function SelectField(props: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label class="block text-xs text-gray-400 uppercase tracking-wide mb-1">{props.label}</label>
      <select
        class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 min-h-[44px] focus:outline-none focus:border-emerald-600"
        value={props.value}
        onChange={(e) => props.onChange(e.currentTarget.value)}
      >
        <For each={props.options}>
          {(opt) => <option value={opt}>{opt || "(None)"}</option>}
        </For>
      </select>
    </div>
  );
}

export default ExercisePicker;
