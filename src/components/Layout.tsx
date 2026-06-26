import { For } from "solid-js";
import type { Component, JSX } from "solid-js";
import type { Tab } from "../App";

interface LayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: JSX.Element;
}

const Layout: Component<LayoutProps> = (props) => {
  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: (
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
        </svg>
      ),
    },
    {
      id: "log",
      label: "Log",
      icon: (
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      id: "exercises",
      label: "Exercises",
      icon: (
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      ),
    },
  ];

  return (
    <div class="flex flex-col h-full bg-[#1a1a1a] text-gray-100">
      <main class="flex-1 overflow-y-auto">{props.children}</main>

      <nav class="flex border-t border-gray-800 bg-[#111] shrink-0">
        <For each={tabs}>{(tab) => (
          <button
            class={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
              props.activeTab === tab.id
                ? "text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
            onClick={() => props.onTabChange(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        )}</For>
      </nav>
    </div>
  );
};

export default Layout;
