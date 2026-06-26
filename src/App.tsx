import { createSignal, Show, type Component } from "solid-js";
import { DbProvider, useDb } from "./db/context";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import Session from "./components/Session";
import Exercises from "./components/Exercises";
import ExerciseDetail from "./components/ExerciseDetail";
import MuscleDetail from "./components/MuscleDetail";

export type Tab = "dashboard" | "log" | "exercises";

export interface Navigation {
  exerciseDetail?: string;
  muscleDetail?: string;
}

const AppContent: Component = () => {
  const { ready, error } = useDb();
  const [activeTab, setActiveTab] = createSignal<Tab>("dashboard");
  const [nav, setNav] = createSignal<Navigation>({});
  // Incremented to tell components to refresh their data
  const [refreshKey, setRefreshKey] = createSignal(0);

  const navigate = (n: Navigation) => setNav(n);
  const clearNav = () => setNav({});

  const handleTabChange = (tab: Tab) => {
    clearNav();
    setActiveTab(tab);
    // Bump refresh so the newly-visible tab reloads its data
    setRefreshKey((k) => k + 1);
  };

  const hasDetailView = () => {
    const n = nav();
    return !!(n.exerciseDetail || n.muscleDetail);
  };

  return (
    <Show
      when={ready()}
      fallback={
        <div class="flex items-center justify-center h-full bg-[#1a1a1a] text-gray-100">
          <Show when={error()} fallback={<p class="text-gray-500">Loading...</p>}>
            <p class="text-red-400">Error: {error()}</p>
          </Show>
        </div>
      }
    >
      <Layout activeTab={activeTab()} onTabChange={handleTabChange}>
        {/* Detail views overlay everything */}
        <Show when={nav().exerciseDetail}>
          {(id) => <ExerciseDetail exerciseId={id()} onBack={clearNav} />}
        </Show>
        <Show when={nav().muscleDetail}>
          {(id) => (
            <MuscleDetail
              muscleId={id()}
              onBack={clearNav}
              onExerciseClick={(eid) => navigate({ exerciseDetail: eid })}
            />
          )}
        </Show>

        {/* Tabs persist — hidden via CSS, never unmounted */}
        <div style={{ display: hasDetailView() || activeTab() !== "dashboard" ? "none" : undefined }}>
          <Dashboard
            refreshKey={refreshKey()}
            onMuscleClick={(id) => navigate({ muscleDetail: id })}
            onExerciseClick={(id) => navigate({ exerciseDetail: id })}
          />
        </div>
        <div style={{ display: hasDetailView() || activeTab() !== "log" ? "none" : undefined }}>
          <Session />
        </div>
        <div style={{ display: hasDetailView() || activeTab() !== "exercises" ? "none" : undefined }}>
          <Exercises refreshKey={refreshKey()} onExerciseClick={(id) => navigate({ exerciseDetail: id })} />
        </div>
      </Layout>
    </Show>
  );
};

const App: Component = () => {
  return (
    <DbProvider>
      <AppContent />
    </DbProvider>
  );
};

export default App;
