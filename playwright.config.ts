import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for Crucible.
 * Runs against the local Vite dev server — no deploy wait, no service-worker
 * cache games. Each test gets a fresh browser context (clean localStorage/IDB).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["line"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    // Mobile-first app — emulate a phone viewport (375px)
    viewport: { width: 375, height: 812 },
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"], serviceWorkers: "block" },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { NODE_ENV: "development" },
  },
});
