import type { Component } from "solid-js";

const Exercises: Component = () => {
  return (
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-6">Exercise Library</h1>
      <div class="rounded-xl bg-gray-800/50 border border-gray-700/50 p-8 flex flex-col items-center justify-center min-h-[200px] gap-4">
        <svg class="w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p class="text-gray-500 text-sm">Exercise library coming soon</p>
      </div>
    </div>
  );
};

export default Exercises;
