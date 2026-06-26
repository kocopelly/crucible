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
  exerciseDetail?: string; // exercise ID
  muscleDetail?: string;   // muscle group ID
}

const AppContent: Component = () => {
  const { ready, error } = useDb();
  const [activeTab, setActiveTab] = createSignal<Tab>("dashboard");
  const [nav, setNav] = createSignal<Navigation>({});

  const navigate = (n: Navigation) => setNav(n);
  const clearNav = () => setNav({});

  const handleTabChange = (tab: Tab) => {
    clearNav();
    setActiveTab(tab);
  };

  const renderContent = () => {
    const n = nav();

    if (n.exerciseDetail) {
      return <ExerciseDetail exerciseId={n.exerciseDetail} onBack={clearNav} />;
    }
    if (n.muscleDetail) {
      return <MuscleDetail muscleId={n.muscleDetail} onBack={clearNav} onExerciseClick={(id) => navigate({ exerciseDetail: id })} />;
    }

    switch (activeTab()) {
      case "dashboard":
        return <Dashboard onMuscleClick={(id) => navigate({ muscleDetail: id })} onExerciseClick={(id) => navigate({ exerciseDetail: id })} />;
      case "log":
        return <Session />;
      case "exercises":
        return <Exercises onExerciseClick={(id) => navigate({ exerciseDetail: id })} />;
    }
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
        {renderContent()}
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
