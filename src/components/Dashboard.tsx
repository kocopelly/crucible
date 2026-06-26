import { createSignal, createEffect, onMount, For, Show, type Component } from "solid-js";
import { useDb } from "../db/context";
import {
  getRecentSessions,
  getWeekStats,
  getSetsForSession,
  getSessionExerciseCount,
  getExercise,
  getWeeklyMuscleVolume,
  exportAllData,
} from "../db/queries";
import type { Session, Set, Exercise } from "../lib/types";

interface SessionSummary {
  session: Session;
  exerciseCount: number;
}

interface SessionDetail {
  session: Session;
  exercises: { exercise: Exercise; sets: Set[] }[];
}

interface MuscleVolume {
  muscleId: string;
  muscle: string;
  sets: number;
}

const MUSCLE_COLORS: Record<string, string> = {
  chest: "#ef4444",
  back: "#3b82f6",
  shoulder: "#f59e0b",
  quad: "#22c55e",
  hamstring: "#14b8a6",
  glute: "#8b5cf6",
  bicep: "#ec4899",
  tricep: "#f97316",
  core: "#06b6d4",
  calf: "#84cc16",
  traps: "#a855f7",
  forearm: "#d946ef",
  adductor: "#64748b",
};

const getMuscleColor = (muscleId: string): string => {
  // Check direct match or parent match
  for (const [key, color] of Object.entries(MUSCLE_COLORS)) {
    if (muscleId === key || muscleId.includes(key)) return color;
  }
  return "#6b7280";
};

// Only show top-level muscle groups in the volume chart
const TOP_LEVEL_MUSCLES = new Set([
  "chest", "back", "shoulder", "quad", "hamstring", "glute",
  "bicep", "tricep", "core", "calf", "traps", "forearm", "adductor",
]);

const Dashboard: Component<{
  refreshKey?: number;
  onMuscleClick?: (id: string) => void;
  onExerciseClick?: (id: string) => void;
}> = (props) => {
  const { db } = useDb();
  const [sessionCount, setSessionCount] = createSignal(0);
  const [setCount, setSetCount] = createSignal(0);
  const [recentSessions, setRecentSessions] = createSignal<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = createSignal<SessionDetail | null>(null);
  const [muscleVolumes, setMuscleVolumes] = createSignal<MuscleVolume[]>([]);
  const [exporting, setExporting] = createSignal(false);

  // Load on mount and whenever refreshKey changes (tab switch)
  createEffect(() => {
    const key = props.refreshKey;
    const d = db();
    console.log("[Dashboard] effect: refreshKey=", key, "db=", !!d);
    if (d) loadDashboard(d);
  });

  const loadDashboard = async (d: NonNullable<ReturnType<typeof db>>) => {
    const stats = await getWeekStats(d);
    console.log("[Dashboard] stats:", stats);
    setSessionCount(stats.sessionCount);
    setSetCount(stats.setCount);

    const sessions = await getRecentSessions(d, 5);
    const summaries: SessionSummary[] = [];
    for (const s of sessions) {
      const count = await getSessionExerciseCount(d, s.id);
      summaries.push({ session: s, exerciseCount: count });
    }
    setRecentSessions(summaries);

    // Load this week's muscle volume (1 week)
    const volumeData = await getWeeklyMuscleVolume(d, 1);
    // Filter to top-level groups only, sort by sets desc
    const thisWeek = volumeData
      .filter((v) => TOP_LEVEL_MUSCLES.has(v.muscleId))
      .sort((a, b) => b.sets - a.sets);
    setMuscleVolumes(thisWeek);
  };

  const viewSession = async (session: Session) => {
    const d = db();
    if (!d) return;

    const sets = await getSetsForSession(d, session.id);
    const exerciseMap = new Map<string, Set[]>();
    for (const s of sets) {
      if (!exerciseMap.has(s.exercise_id)) exerciseMap.set(s.exercise_id, []);
      exerciseMap.get(s.exercise_id)!.push(s);
    }

    const exercises: { exercise: Exercise; sets: Set[] }[] = [];
    for (const [exId, exSets] of exerciseMap) {
      const exercise = await getExercise(d, exId);
      if (exercise) exercises.push({ exercise, sets: exSets });
    }

    setSelectedSession({ session, exercises });
  };

  const handleExport = async () => {
    const d = db();
    if (!d) return;
    setExporting(true);
    try {
      const json = await exportAllData(d);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crucible-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const maxVolume = () => {
    const vols = muscleVolumes();
    return vols.length > 0 ? Math.max(...vols.map((v) => v.sets)) : 1;
  };

  return (
    <div class="px-3 py-4">
      <h1 class="text-2xl font-bold mb-4">Dashboard</h1>

      {/* Weekly stats */}
      <div class="grid grid-cols-2 gap-3 mb-5">
        <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
          <p class="text-xs text-gray-500 uppercase tracking-wide">This Week</p>
          <p class="text-3xl font-bold mt-1">{sessionCount()}</p>
          <p class="text-xs text-gray-500">session{sessionCount() !== 1 ? "s" : ""}</p>
        </div>
        <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-3">
          <p class="text-xs text-gray-500 uppercase tracking-wide">Total Sets</p>
          <p class="text-3xl font-bold mt-1">{setCount()}</p>
          <p class="text-xs text-gray-500">this week</p>
        </div>
      </div>

      {/* Muscle Volume — Hero Metric */}
      <h2 class="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Weekly Volume by Muscle</h2>
      <Show
        when={muscleVolumes().length > 0}
        fallback={
          <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-6 text-center mb-5">
            <p class="text-gray-500 text-sm">Log some sets to see muscle volume!</p>
          </div>
        }
      >
        <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-3 mb-5 space-y-2">
          <For each={muscleVolumes()}>
            {(vol) => (
              <button
                class="w-full text-left"
                onClick={() => props.onMuscleClick?.(vol.muscleId)}
              >
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-400 w-20 shrink-0 truncate capitalize">{vol.muscle}</span>
                  <div class="flex-1 h-5 bg-gray-700/30 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max((vol.sets / maxVolume()) * 100, 4)}%`,
                        "background-color": getMuscleColor(vol.muscleId),
                      }}
                    />
                  </div>
                  <span class="text-xs text-gray-400 w-8 text-right shrink-0">{vol.sets}</span>
                </div>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Session detail modal */}
      <Show when={selectedSession()}>
        {(detail) => (
          <div class="fixed inset-0 z-50 bg-black/70 flex items-end justify-center" onClick={(e) => { if (e.target === e.currentTarget) setSelectedSession(null); }}>
            <div class="bg-[#1a1a1a] w-full max-w-lg rounded-t-2xl max-h-[80vh] flex flex-col">
              <div class="flex items-center justify-between p-4 border-b border-gray-700/50">
                <h2 class="text-lg font-bold">{formatDate(detail().session.date)}</h2>
                <button onClick={() => setSelectedSession(null)} class="text-gray-400 hover:text-white p-2">
                  <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div class="flex-1 overflow-y-auto p-4 space-y-3">
                <For each={detail().exercises}>
                  {(block) => (
                    <button
                      class="w-full text-left rounded-lg bg-gray-800/50 border border-gray-700/50 p-3 hover:border-emerald-600/50 transition-colors"
                      onClick={() => { setSelectedSession(null); props.onExerciseClick?.(block.exercise.id); }}
                    >
                      <h3 class="font-medium text-gray-100 mb-2">{block.exercise.display_name}</h3>
                      <div class="space-y-1">
                        <For each={block.sets}>
                          {(set, i) => (
                            <div class="flex items-center gap-2 text-sm text-gray-400">
                              <span class="text-gray-600 w-6">{i() + 1}.</span>
                              <span>{set.weight} lbs</span>
                              <span class="text-gray-600">×</span>
                              <span>{set.reps} reps</span>
                            </div>
                          )}
                        </For>
                      </div>
                    </button>
                  )}
                </For>
                <Show when={detail().exercises.length === 0}>
                  <p class="text-gray-500 text-sm text-center py-4">No exercises logged</p>
                </Show>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* Recent sessions */}
      <h2 class="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Recent Sessions</h2>
      <Show
        when={recentSessions().length > 0}
        fallback={
          <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-6 text-center mb-5">
            <p class="text-gray-500 text-sm">No workouts yet. Hit the Log tab to start!</p>
          </div>
        }
      >
        <div class="space-y-2 mb-5">
          <For each={recentSessions()}>
            {(item) => (
              <button
                class="w-full text-left rounded-xl bg-gray-800/50 border border-gray-700/50 p-3 hover:border-emerald-600/50 transition-colors"
                onClick={() => viewSession(item.session)}
              >
                <div class="flex justify-between items-center">
                  <span class="font-medium text-gray-100">{formatDate(item.session.date)}</span>
                  <span class="text-sm text-gray-500">
                    {item.exerciseCount} exercise{item.exerciseCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Export */}
      <button
        class="w-full py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors text-sm"
        onClick={handleExport}
        disabled={exporting()}
      >
        {exporting() ? "Exporting..." : "📦 Export Data (JSON)"}
      </button>
    </div>
  );
};

export default Dashboard;
