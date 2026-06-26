import { createSignal, onMount, For, Show, type Component } from "solid-js";
import { useDb } from "../db/context";
import { getExercise, getExerciseHistory, getExerciseMuscles } from "../db/queries";
import type { Exercise, Set, Session } from "../lib/types";

interface SessionHistory {
  session: Session;
  sets: Set[];
}

/** Epley formula: weight × (1 + reps/30) */
const estimate1RM = (weight: number, reps: number): number => {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
};

const ExerciseDetail: Component<{
  exerciseId: string;
  onBack: () => void;
}> = (props) => {
  const { db } = useDb();
  const [exercise, setExercise] = createSignal<Exercise | null>(null);
  const [history, setHistory] = createSignal<SessionHistory[]>([]);
  const [muscles, setMuscles] = createSignal<{ id: string; weight: number }[]>([]);

  onMount(() => {
    const d = db();
    if (!d) return;
    loadExercise(d);
  });

  const loadExercise = async (d: NonNullable<ReturnType<typeof db>>) => {
    const ex = await getExercise(d, props.exerciseId);
    setExercise(ex);

    const hist = await getExerciseHistory(d, props.exerciseId);
    setHistory(hist);

    const mus = await getExerciseMuscles(d, props.exerciseId);
    setMuscles(mus.map((m) => ({ id: m.muscle_group_id, weight: m.weight })));
  };

  // Compute stats from history
  const stats = () => {
    const h = history();
    if (h.length === 0) return null;

    let peakWeight = 0;
    let best1RM = 0;
    let totalSets = 0;

    for (const session of h) {
      for (const set of session.sets) {
        totalSets++;
        if (set.weight > peakWeight) peakWeight = set.weight;
        const est = estimate1RM(set.weight, set.reps);
        if (est > best1RM) best1RM = est;
      }
    }

    return { peakWeight, best1RM, totalSessions: h.length, totalSets };
  };

  // Recent 1RM trend (per session, take best set)
  const rmTrend = () => {
    return history()
      .map((h) => {
        let best = 0;
        for (const s of h.sets) {
          const est = estimate1RM(s.weight, s.reps);
          if (est > best) best = est;
        }
        return { date: h.session.date, rm: best };
      })
      .reverse(); // chronological
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const maxRM = () => {
    const trend = rmTrend();
    return trend.length > 0 ? Math.max(...trend.map((t) => t.rm)) : 1;
  };

  return (
    <div class="px-3 py-4">
      {/* Header */}
      <button
        class="flex items-center gap-1 text-gray-400 hover:text-white mb-3 -ml-1"
        onClick={props.onBack}
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span class="text-sm">Back</span>
      </button>

      <Show when={exercise()} fallback={<p class="text-gray-500">Loading...</p>}>
        {(ex) => (
          <>
            <h1 class="text-xl font-bold mb-1 leading-tight">{ex().display_name}</h1>
            <p class="text-xs text-gray-500 mb-4">
              {ex().position} · {ex().equipment} · {ex().movement}
            </p>

            {/* Stats cards */}
            <Show when={stats()}>
              {(s) => (
                <div class="grid grid-cols-3 gap-2 mb-5">
                  <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-3 text-center">
                    <p class="text-xs text-gray-500">Est. 1RM</p>
                    <p class="text-xl font-bold text-emerald-400">{s().best1RM}</p>
                    <p class="text-xs text-gray-500">lbs</p>
                  </div>
                  <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-3 text-center">
                    <p class="text-xs text-gray-500">Peak</p>
                    <p class="text-xl font-bold">{s().peakWeight}</p>
                    <p class="text-xs text-gray-500">lbs</p>
                  </div>
                  <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-3 text-center">
                    <p class="text-xs text-gray-500">Sessions</p>
                    <p class="text-xl font-bold">{s().totalSessions}</p>
                    <p class="text-xs text-gray-500">{s().totalSets} sets</p>
                  </div>
                </div>
              )}
            </Show>

            {/* 1RM Trend Chart */}
            <Show when={rmTrend().length > 1}>
              <h2 class="text-sm font-medium text-gray-400 uppercase tracking-wide mb-2">Est. 1RM Trend</h2>
              <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-3 mb-5">
                <div class="flex items-end gap-1 h-24">
                  <For each={rmTrend()}>
                    {(point) => (
                      <div class="flex-1 flex flex-col items-center justify-end h-full">
                        <div
                          class="w-full rounded-t bg-emerald-500/80 min-h-[2px]"
                          style={{ height: `${Math.max((point.rm / maxRM()) * 100, 3)}%` }}
                          title={`${formatDate(point.date)}: ${point.rm} lbs`}
                        />
                        <span class="text-[9px] text-gray-600 mt-1 truncate w-full text-center">
                          {formatDate(point.date)}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Muscle targets */}
            <Show when={muscles().length > 0}>
              <h2 class="text-sm font-medium text-gray-400 uppercase tracking-wide mb-2">Muscles</h2>
              <div class="flex flex-wrap gap-2 mb-5">
                <For each={muscles()}>
                  {(m) => (
                    <span class={`text-xs px-2 py-1 rounded-full ${m.weight >= 1 ? "bg-emerald-600/30 text-emerald-400" : "bg-gray-700/50 text-gray-400"}`}>
                      {m.id.replace(/-/g, " ")} · {m.weight}
                    </span>
                  )}
                </For>
              </div>
            </Show>

            {/* Session History */}
            <h2 class="text-sm font-medium text-gray-400 uppercase tracking-wide mb-2">History</h2>
            <Show
              when={history().length > 0}
              fallback={<p class="text-gray-500 text-sm py-4 text-center">No logged sessions yet</p>}
            >
              <div class="space-y-2">
                <For each={history()}>
                  {(h) => (
                    <div class="rounded-lg bg-gray-800/50 border border-gray-700/50 p-3">
                      <p class="text-xs text-gray-500 mb-2">{formatDate(h.session.date)}</p>
                      <div class="space-y-1">
                        <For each={h.sets}>
                          {(set, i) => (
                            <div class="flex items-center gap-2 text-sm">
                              <span class="text-gray-600 w-5">{i() + 1}.</span>
                              <span class="text-gray-100">{set.weight} lbs</span>
                              <span class="text-gray-600">×</span>
                              <span class="text-gray-100">{set.reps}</span>
                              <span class="text-gray-600 text-xs ml-auto">
                                ~{estimate1RM(set.weight, set.reps)} 1RM
                              </span>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
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

export default ExerciseDetail;
