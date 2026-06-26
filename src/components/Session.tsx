import type { Component } from "solid-js";

const Session: Component = () => {
  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">New Session</h1>
      <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-8 flex flex-col items-center justify-center min-h-[300px] gap-4">
        <svg class="w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <p class="text-gray-500 text-sm">Tap to start a workout</p>
      </div>
    </div>
  );
};

export default Session;
