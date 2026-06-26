import type { Component } from "solid-js";

const Dashboard: Component = () => {
  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">Weekly Volume</h1>
      <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-8 flex items-center justify-center min-h-[200px]">
        <p class="text-gray-500 text-sm">Volume chart coming soon</p>
      </div>
      <div class="mt-6 grid grid-cols-2 gap-4">
        <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4">
          <p class="text-xs text-gray-500 uppercase tracking-wide">Sessions</p>
          <p class="text-2xl font-bold mt-1">—</p>
        </div>
        <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-4">
          <p class="text-xs text-gray-500 uppercase tracking-wide">Total Sets</p>
          <p class="text-2xl font-bold mt-1">—</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
