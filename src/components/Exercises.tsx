import { createSignal, createEffect, For, Show, type Component } from "solid-js";
import { useDb } from "../db/context";
import { getAllExercises, searchExercises, getExerciseMuscles, getAllMuscleGroups } from "../db/queries";
import type { Exercise, MuscleGroup } from "../lib/types";
import ExercisePicker from "./ExercisePicker";

const Exercises: Component = () => {
  const { db } = useDb();
  const [exercises, setExercises] = createSignal<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showPicker, setShowPicker] = createSignal(false);

  const loadExercises = async () => {
    const d = db();
    if (!d) return;
    const q = searchQuery();
    const results = q ? await searchExercises(d, q) : await getAllExercises(d);
    setExercises(results);
  };

  createEffect(() => {
    const d = db();
    if (!d) return;
    searchQuery(); // track
    loadExercises();
  });

  const handleCreated = (exercise: Exercise) => {
    setShowPicker(false);
    loadExercises();
  };

  return (
    <div class="p-4">
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
          <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-8 text-center">
            <p class="text-gray-500 text-sm">
              {searchQuery() ? "No exercises match your search" : "No exercises yet. Create one!"}
            </p>
          </div>
        }
      >
        <div class="space-y-2">
          <For each={exercises()}>
            {(exercise) => (
              <div class="rounded-lg bg-gray-800/50 border border-gray-700/50 p-3">
                <p class="font-medium text-gray-100">{exercise.display_name}</p>
                <p class="text-xs text-gray-500 mt-1">
                  {exercise.position} · {exercise.equipment} · {exercise.movement}
                </p>
              </div>
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
