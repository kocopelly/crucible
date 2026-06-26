import { createSignal, onMount, For, Show, type Component } from "solid-js";
import { useDb } from "../db/context";
import {
  createSession,
  getActiveSession,
  finishSession,
  addSet,
  updateSet,
  deleteSet,
  getSetsForSession,
  getLastSetsForExercise,
  getExercise,
} from "../db/queries";
import type { Exercise, Session as SessionType, Set } from "../lib/types";
import ExercisePicker from "./ExercisePicker";

interface ExerciseBlock {
  exercise: Exercise;
  sets: Set[];
  lastTime: { date: string; sets: Set[] } | null;
}

const SetRow: Component<{
  set: Set;
  index: number;
  onUpdate: (field: "weight" | "reps", value: number) => void;
  onDelete: () => void;
}> = (props) => {
  return (
    <div class="flex items-center gap-1">
      <span class="text-gray-500 text-xs w-5 text-center shrink-0">{props.index + 1}</span>
      <input
        type="number"
        inputmode="decimal"
        value={props.set.weight || ""}
        placeholder="0"
        class="flex-1 min-w-0 bg-gray-700/50 border border-gray-600/50 rounded-lg px-2 py-2 text-center text-gray-100 min-h-[44px] focus:outline-none focus:border-emerald-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        onBlur={(e) => {
          const v = parseFloat(e.currentTarget.value) || 0;
          props.onUpdate("weight", v);
        }}
      />
      <span class="text-gray-500 text-xs shrink-0">×</span>
      <input
        type="number"
        inputmode="numeric"
        value={props.set.reps || ""}
        placeholder="0"
        class="flex-1 min-w-0 bg-gray-700/50 border border-gray-600/50 rounded-lg px-2 py-2 text-center text-gray-100 min-h-[44px] focus:outline-none focus:border-emerald-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        onBlur={(e) => {
          const v = parseInt(e.currentTarget.value) || 0;
          props.onUpdate("reps", v);
        }}
      />
      <button
        class="text-gray-600 hover:text-red-400 transition-colors w-8 h-[44px] flex items-center justify-center shrink-0"
        onClick={() => props.onDelete()}
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

const Session: Component = () => {
  const { db } = useDb();
  const [session, setSession] = createSignal<SessionType | null>(null);
  const [blocks, setBlocks] = createSignal<ExerciseBlock[]>([]);
  const [showPicker, setShowPicker] = createSignal(false);
  const [finished, setFinished] = createSignal(false);
  const [loading, setLoading] = createSignal(true);

  // On mount: check for an active (unfinished) session and resume it
  onMount(() => {
    const d = db();
    if (d) resumeActiveSession(d);
  });

  const resumeActiveSession = async (d: NonNullable<ReturnType<typeof db>>) => {
    setLoading(true);
    try {
      const active = await getActiveSession(d);
      if (active) {
        setSession(active);
        setFinished(false);
        await loadSessionBlocks(d, active.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSessionBlocks = async (d: NonNullable<ReturnType<typeof db>>, sessionId: string) => {
    const sets = await getSetsForSession(d, sessionId);
    // Group sets by exercise
    const exerciseMap = new Map<string, Set[]>();
    const exerciseOrder: string[] = [];
    for (const s of sets) {
      if (!exerciseMap.has(s.exercise_id)) {
        exerciseMap.set(s.exercise_id, []);
        exerciseOrder.push(s.exercise_id);
      }
      exerciseMap.get(s.exercise_id)!.push(s);
    }

    const newBlocks: ExerciseBlock[] = [];
    for (const exId of exerciseOrder) {
      const exercise = await getExercise(d, exId);
      if (exercise) {
        const lastTime = await getLastSetsForExercise(d, exercise.id);
        newBlocks.push({ exercise, sets: exerciseMap.get(exId)!, lastTime });
      }
    }
    setBlocks(newBlocks);
  };

  const startWorkout = async () => {
    const d = db();
    if (!d) return;
    const today = new Date().toISOString().split("T")[0];
    const s = await createSession(d, today);
    setSession(s);
    setFinished(false);
    setBlocks([]);
  };

  const handleExerciseSelected = async (exercise: Exercise) => {
    const d = db();
    if (!d) return;
    setShowPicker(false);

    const lastTime = await getLastSetsForExercise(d, exercise.id);
    const sessionId = session()!.id;

    const prefillSets: Set[] = [];
    if (lastTime && lastTime.sets.length > 0) {
      for (const ls of lastTime.sets) {
        const newSet = await addSet(d, {
          session_id: sessionId,
          exercise_id: exercise.id,
          set_order: ls.set_order,
          weight: ls.weight,
          reps: ls.reps,
          notes: null,
        });
        prefillSets.push(newSet);
      }
    } else {
      const newSet = await addSet(d, {
        session_id: sessionId,
        exercise_id: exercise.id,
        set_order: 1,
        weight: 0,
        reps: 0,
        notes: null,
      });
      prefillSets.push(newSet);
    }

    setBlocks((prev) => [...prev, { exercise, sets: prefillSets, lastTime }]);
  };

  const handleAddSet = async (blockIndex: number) => {
    const d = db();
    const s = session();
    if (!d || !s) return;

    const block = blocks()[blockIndex];
    const nextOrder = block.sets.length + 1;
    const lastSet = block.sets[block.sets.length - 1];

    const newSet = await addSet(d, {
      session_id: s.id,
      exercise_id: block.exercise.id,
      set_order: nextOrder,
      weight: lastSet?.weight ?? 0,
      reps: lastSet?.reps ?? 0,
      notes: null,
    });

    setBlocks((prev) => {
      const updated = [...prev];
      updated[blockIndex] = { ...updated[blockIndex], sets: [...updated[blockIndex].sets, newSet] };
      return updated;
    });
  };

  const handleUpdateSet = async (blockIndex: number, setIndex: number, field: "weight" | "reps", value: number) => {
    const d = db();
    if (!d) return;

    const set = blocks()[blockIndex].sets[setIndex];
    await updateSet(d, set.id, { [field]: value });

    setBlocks((prev) => {
      const updated = [...prev];
      const updatedSets = [...updated[blockIndex].sets];
      updatedSets[setIndex] = { ...updatedSets[setIndex], [field]: value };
      updated[blockIndex] = { ...updated[blockIndex], sets: updatedSets };
      return updated;
    });
  };

  const handleDeleteSet = async (blockIndex: number, setIndex: number) => {
    const d = db();
    if (!d) return;

    const set = blocks()[blockIndex].sets[setIndex];
    await deleteSet(d, set.id);

    setBlocks((prev) => {
      const updated = [...prev];
      const updatedSets = updated[blockIndex].sets.filter((_, i) => i !== setIndex);
      updated[blockIndex] = { ...updated[blockIndex], sets: updatedSets };
      return updated;
    });
  };

  const handleFinishWorkout = async () => {
    const d = db();
    const s = session();
    if (!d || !s) return;

    await finishSession(d, s.id);
    setFinished(true);
  };

  const newWorkout = () => {
    setSession(null);
    setBlocks([]);
    setFinished(false);
  };

  return (
    <div class="px-3 py-4">
      <h1 class="text-2xl font-bold mb-4">Log Workout</h1>

      {/* Loading */}
      <Show when={loading()}>
        <p class="text-gray-500 text-sm text-center py-8">Loading...</p>
      </Show>

      {/* No active session */}
      <Show when={!loading() && !session()}>
        <button
          class="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-4 text-lg transition-colors min-h-[56px]"
          onClick={startWorkout}
        >
          Start Workout
        </button>
      </Show>

      {/* Finished state */}
      <Show when={finished()}>
        <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-6 text-center">
          <svg class="w-12 h-12 text-emerald-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p class="text-lg font-bold text-gray-100 mb-1">Workout Complete!</p>
          <p class="text-gray-400 text-sm mb-4">
            {blocks().length} exercise{blocks().length !== 1 ? "s" : ""} ·{" "}
            {blocks().reduce((sum, b) => sum + b.sets.length, 0)} sets
          </p>
          <button
            class="w-full py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors min-h-[44px]"
            onClick={newWorkout}
          >
            Start Another
          </button>
        </div>
      </Show>

      {/* Active session */}
      <Show when={!loading() && session() && !finished()}>
        <div class="space-y-3">
          <For each={blocks()}>
            {(block, blockIndex) => (
              <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 overflow-hidden">
                <div class="px-3 py-2.5 border-b border-gray-700/50">
                  <h3 class="font-medium text-gray-100 text-sm leading-tight">{block.exercise.display_name}</h3>
                  <Show when={block.lastTime}>
                    <p class="text-xs text-gray-500 mt-0.5">
                      Last: {block.lastTime!.date} — {block.lastTime!.sets.map((s) => `${s.weight}×${s.reps}`).join(", ")}
                    </p>
                  </Show>
                </div>

                <div class="px-2 py-2 space-y-1.5">
                  {/* Header row */}
                  <div class="flex items-center gap-1 text-xs text-gray-500 px-1">
                    <span class="w-5 shrink-0">#</span>
                    <span class="flex-1">Weight</span>
                    <span class="shrink-0">&nbsp;</span>
                    <span class="flex-1">Reps</span>
                    <span class="w-8 shrink-0"></span>
                  </div>

                  <For each={block.sets}>
                    {(set, setIndex) => (
                      <SetRow
                        set={set}
                        index={setIndex()}
                        onUpdate={(field, value) => handleUpdateSet(blockIndex(), setIndex(), field, value)}
                        onDelete={() => handleDeleteSet(blockIndex(), setIndex())}
                      />
                    )}
                  </For>

                  <button
                    class="w-full py-2 text-sm text-gray-400 hover:text-emerald-400 transition-colors min-h-[40px]"
                    onClick={() => handleAddSet(blockIndex())}
                  >
                    + Add Set
                  </button>
                </div>
              </div>
            )}
          </For>

          <button
            class="w-full py-3 rounded-xl border-2 border-dashed border-gray-600 text-gray-400 hover:border-emerald-600 hover:text-emerald-400 transition-colors min-h-[48px]"
            onClick={() => setShowPicker(true)}
          >
            + Add Exercise
          </button>

          <Show when={blocks().length > 0}>
            <button
              class="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors min-h-[48px]"
              onClick={handleFinishWorkout}
            >
              Finish Workout
            </button>
          </Show>
        </div>
      </Show>

      <Show when={showPicker()}>
        <ExercisePicker
          onSelect={handleExerciseSelected}
          onClose={() => setShowPicker(false)}
        />
      </Show>
    </div>
  );
};

export default Session;
