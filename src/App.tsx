import { createSignal, type Component } from "solid-js";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import Session from "./components/Session";
import Exercises from "./components/Exercises";

export type Tab = "dashboard" | "log" | "exercises";

const App: Component = () => {
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
    <Layout activeTab={activeTab()} onTabChange={setActiveTab}>
      {renderTab()}
    </Layout>
  );
};

export default App;
