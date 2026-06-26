import { createSignal, createEffect, For, Show, type Component } from "solid-js";
import { useDb } from "../db/context";
import {
  getRecentSessions,
  getWeekStats,
  getSetsForSession,
  getSessionExerciseCount,
  getExercise,
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

const Dashboard: Component = () => {
  const { db, ready } = useDb();
  const [sessionCount, setSessionCount] = createSignal(0);
  const [setCount, setSetCount] = createSignal(0);
  const [recentSessions, setRecentSessions] = createSignal<SessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = createSignal<SessionDetail | null>(null);

  // Load stats when db is ready
  createEffect(async () => {
    const d = db();
    if (!d) return;

    const stats = await getWeekStats(d);
    setSessionCount(stats.sessionCount);
    setSetCount(stats.setCount);

    const sessions = await getRecentSessions(d, 5);
    const summaries: SessionSummary[] = [];
    for (const s of sessions) {
      const count = await getSessionExerciseCount(d, s.id);
      summaries.push({ session: s, exerciseCount: count });
    }
    setRecentSessions(summaries);
  });

  const viewSession = async (session: Session) => {
    const d = db();
    if (!d) return;

    const sets = await getSetsForSession(d, session.id);
    // Group sets by exercise
    const exerciseMap = new Map<string, Set[]>();
    for (const s of sets) {
      if (!exerciseMap.has(s.exercise_id)) exerciseMap.set(s.exercise_id, []);
      exerciseMap.get(s.exercise_id)!.push(s);
    }

    const exercises: { exercise: Exercise; sets: Set[] }[] = [];
    for (const [exId, exSets] of exerciseMap) {
      const exercise = await getExercise(d, exId);
      if (exercise) {
        exercises.push({ exercise, sets: exSets });
      }
    }

    setSelectedSession({ session, exercises });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  return (
    <div class="p-4">
      <h1 class="text-2xl font-bold mb-4">Dashboard</h1>

      {/* Weekly stats */}
      <div class="grid grid-cols-2 gap-3 mb-6">
        <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4">
          <p class="text-xs text-gray-500 uppercase tracking-wide">This Week</p>
          <p class="text-3xl font-bold mt-1">{sessionCount()}</p>
          <p class="text-xs text-gray-500">session{sessionCount() !== 1 ? "s" : ""}</p>
        </div>
        <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4">
          <p class="text-xs text-gray-500 uppercase tracking-wide">Total Sets</p>
          <p class="text-3xl font-bold mt-1">{setCount()}</p>
          <p class="text-xs text-gray-500">this week</p>
        </div>
      </div>

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
                    <div class="rounded-lg bg-gray-800/50 border border-gray-700/50 p-3">
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
                    </div>
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
          <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-8 text-center">
            <p class="text-gray-500 text-sm">No workouts yet. Hit the Log tab to start!</p>
          </div>
        }
      >
        <div class="space-y-2">
          <For each={recentSessions()}>
            {(item) => (
              <button
                class="w-full text-left rounded-xl bg-gray-800/50 border border-gray-700/50 p-4 hover:border-emerald-600/50 transition-colors min-h-[44px]"
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
    </div>
  );
};

export default Dashboard;
