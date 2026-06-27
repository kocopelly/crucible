import { createSignal, onMount, For, Show, type Component } from "solid-js";
import { getDB } from "../db/init";
import {
  getWeeklyMuscleVolume,
  getExercisesForMuscle,
  getAllMuscleGroups,
} from "../db/queries";
import type { Exercise, MuscleGroup } from "../lib/types";

type DB = Awaited<ReturnType<typeof getDB>>;

const MuscleDetail: Component<{
  muscleId: string;
  onBack: () => void;
  onExerciseClick: (id: string) => void;
}> = (props) => {
  const [muscle, setMuscle] = createSignal<MuscleGroup | null>(null);
  const [weeklyVolume, setWeeklyVolume] = createSignal<{ week: string; sets: number }[]>([]);
  const [childVolume, setChildVolume] = createSignal<{ muscleId: string; muscle: string; sets: number }[]>([]);
  const [exercises, setExercises] = createSignal<{ exercise: Exercise; weight: number }[]>([]);

  onMount(() => {
    getDB().then((d) => loadMuscle(d));
  });

  const loadMuscle = async (d: DB) => {
    const allGroups = await getAllMuscleGroups(d);
    const m = allGroups.find((g) => g.id === props.muscleId);
    setMuscle(m ?? null);

    // Find child groups
    const kids = allGroups.filter((g) => g.parent === props.muscleId);

    // Weekly volume for this muscle (8 weeks)
    const volume = await getWeeklyMuscleVolume(d, 8);
    const myVolume = volume
      .filter((v) => v.muscleId === props.muscleId)
      .map((v) => ({ week: v.week, sets: v.sets }));
    setWeeklyVolume(myVolume);

    // Child breakdown (current week only)
    if (kids.length > 0) {
      const thisWeekVol = volume.filter(
        (v) => kids.some((k) => k.id === v.muscleId) && myVolume.length > 0 && v.week === myVolume[myVolume.length - 1]?.week
      );
      setChildVolume(thisWeekVol.map((v) => ({ muscleId: v.muscleId, muscle: v.muscle, sets: v.sets })));
    }

    // Exercises that target this muscle
    const exs = await getExercisesForMuscle(d, props.muscleId);
    setExercises(exs);
  };

  const formatWeek = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const maxVol = () => {
    const vols = weeklyVolume();
    return vols.length > 0 ? Math.max(...vols.map((v) => v.sets)) : 1;
  };

  return (
    <div class="px-3 py-4">
      <button
        class="flex items-center gap-1 text-gray-400 hover:text-white mb-3 -ml-1"
        onClick={props.onBack}
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span class="text-sm">Back</span>
      </button>

      <Show when={muscle()} fallback={<p class="text-gray-500">Loading...</p>}>
        {(m) => (
          <>
            <h1 class="text-xl font-bold mb-4 capitalize">{m().name}</h1>

            {/* Weekly volume chart */}
            <h2 class="text-sm font-medium text-gray-400 uppercase tracking-wide mb-2">Weekly Volume (8 weeks)</h2>
            <Show
              when={weeklyVolume().length > 0}
              fallback={
                <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-6 text-center mb-5">
                  <p class="text-gray-500 text-sm">No volume data yet</p>
                </div>
              }
            >
              <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-3 mb-5">
                <div class="flex items-end gap-1 h-28">
                  <For each={weeklyVolume()}>
                    {(point) => (
                      <div class="flex-1 flex flex-col items-center justify-end h-full">
                        <span class="text-[10px] text-gray-400 mb-1">{point.sets}</span>
                        <div
                          class="w-full rounded-t bg-blue-500/80 min-h-[2px]"
                          style={{ height: `${Math.max((point.sets / maxVol()) * 100, 3)}%` }}
                        />
                        <span class="text-[9px] text-gray-600 mt-1 truncate w-full text-center">
                          {formatWeek(point.week)}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Sub-group breakdown */}
            <Show when={childVolume().length > 0}>
              <h2 class="text-sm font-medium text-gray-400 uppercase tracking-wide mb-2">Breakdown</h2>
              <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-3 mb-5 space-y-2">
                <For each={childVolume()}>
                  {(cv) => {
                    const parent = weeklyVolume();
                    const total = parent.length > 0 ? parent[parent.length - 1].sets : 1;
                    return (
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-400 w-24 shrink-0 truncate capitalize">{cv.muscle}</span>
                        <div class="flex-1 h-4 bg-gray-700/30 rounded-full overflow-hidden">
                          <div
                            class="h-full rounded-full bg-blue-500/60"
                            style={{ width: `${Math.max((cv.sets / total) * 100, 4)}%` }}
                          />
                        </div>
                        <span class="text-xs text-gray-400 w-8 text-right">{cv.sets}</span>
                      </div>
                    );
                  }}
                </For>
              </div>
            </Show>

            {/* Contributing exercises */}
            <h2 class="text-sm font-medium text-gray-400 uppercase tracking-wide mb-2">Exercises</h2>
            <Show
              when={exercises().length > 0}
              fallback={<p class="text-gray-500 text-sm py-4 text-center">No exercises target this muscle yet</p>}
            >
              <div class="space-y-2">
                <For each={exercises()}>
                  {(item) => (
                    <button
                      class="w-full text-left rounded-lg bg-gray-800/50 border border-gray-700/50 p-3 hover:border-emerald-600/50 transition-colors"
                      onClick={() => props.onExerciseClick(item.exercise.id)}
                    >
                      <p class="font-medium text-gray-100 text-sm">{item.exercise.display_name}</p>
                      <p class="text-xs text-gray-500 mt-0.5">
                        {item.weight >= 1 ? "Primary" : "Secondary"} · {item.weight}
                      </p>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
};

export default MuscleDetail;
