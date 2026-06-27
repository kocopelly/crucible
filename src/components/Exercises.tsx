import { createSignal, createEffect, For, Show, type Component } from "solid-js";
import { getDB } from "../db/init";
import { getAllExercises, searchExercises } from "../db/queries";
import type { Exercise } from "../lib/types";
import ExercisePicker from "./ExercisePicker";

const Exercises: Component<{
  refreshKey?: number;
  onExerciseClick?: (id: string) => void;
}> = (props) => {
  type DB = Awaited<ReturnType<typeof getDB>>;
  const [exercises, setExercises] = createSignal<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showPicker, setShowPicker] = createSignal(false);

  const loadExercises = async (d: DB, q: string) => {
    const results = q ? await searchExercises(d, q) : await getAllExercises(d);
    setExercises(results);
  };

  // Reload when search query or refreshKey changes
  createEffect(() => {
    void props.refreshKey; // track changes on tab switch
    const q = searchQuery();
    getDB().then((d) => loadExercises(d, q));
  });

  const handleCreated = () => {
    setShowPicker(false);
    getDB().then((d) => loadExercises(d, searchQuery()));
  };

  return (
    <div class="px-3 py-4">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold">Exercises</h1>
        <button
          class="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors min-h-[44px]"
          onClick={() => setShowPicker(true)}
        >
          + New
        </button>
      </div>

      <input
        type="text"
        placeholder="Search exercises..."
        value={searchQuery()}
        onInput={(e) => setSearchQuery(e.currentTarget.value)}
        class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 mb-4 focus:outline-none focus:border-emerald-600"
      />

      <Show
        when={exercises().length > 0}
        fallback={
          <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-6 text-center">
            <p class="text-gray-500 text-sm">
              {searchQuery() ? "No exercises match your search" : "No exercises yet. Create one!"}
            </p>
          </div>
        }
      >
        <div class="space-y-2">
          <For each={exercises()}>
            {(exercise) => (
              <button
                class="w-full text-left rounded-lg bg-gray-800/50 border border-gray-700/50 p-3 hover:border-emerald-600/50 transition-colors"
                onClick={() => props.onExerciseClick?.(exercise.id)}
              >
                <p class="font-medium text-gray-100">{exercise.display_name}</p>
                <p class="text-xs text-gray-500 mt-1">
                  {exercise.position} · {exercise.equipment} · {exercise.movement}
                </p>
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={showPicker()}>
        <ExercisePicker onSelect={handleCreated} onClose={() => setShowPicker(false)} />
      </Show>
    </div>
  );
};

export default Exercises;
