import { createSignal, Show, type Component } from "solid-js";
import { DbProvider, useDb } from "./db/context";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import Session from "./components/Session";
import Exercises from "./components/Exercises";

export type Tab = "dashboard" | "log" | "exercises";

const AppContent: Component = () => {
  const { ready, error } = useDb();
  const [activeTab, setActiveTab] = createSignal<Tab>("dashboard");

  const renderTab = () => {
    switch (activeTab()) {
      case "dashboard":
        return <Dashboard />;
      case "log":
        return <Session />;
      case "exercises":
        return <Exercises />;
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
      <Layout activeTab={activeTab()} onTabChange={setActiveTab}>
        {renderTab()}
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
