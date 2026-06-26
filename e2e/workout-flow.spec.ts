import { test, expect, type Page } from "@playwright/test";

/**
 * Full workout loop — the flow that kept regressing:
 *   start workout -> create exercise -> log a set -> finish -> dashboard shows stats
 * Plus the two specific bugs:
 *   - workout survives tab switch mid-session
 *   - dashboard refreshes after finishing
 */

async function waitForReady(page: Page) {
  // App gates rendering on DB init; wait for the nav tabs to appear.
  await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
}

async function startWorkoutAndCreateExercise(page: Page) {
  await page.getByRole("button", { name: "Log" }).click();
  await page.getByRole("button", { name: /Start Workout/i }).click();
  await page.getByRole("button", { name: /Add Exercise/i }).click();
  await page.getByRole("button", { name: /Create New/i }).click();
  // Fresh DB seeds default selects; just hit Create with defaults.
  await page.getByRole("button", { name: /^Create$/i }).click();
  await page.getByRole("button", { name: /^Done$/i }).click();
}

test("workout survives tab switch", async ({ page }) => {
  await page.goto("/");
  await waitForReady(page);

  await startWorkoutAndCreateExercise(page);

  // An exercise card with a set row should be visible in the session.
  await expect(page.getByText(/Add Set/i)).toBeVisible();

  // Tab away and back.
  await page.getByRole("button", { name: "Dashboard" }).click();
  await page.getByRole("button", { name: "Log" }).click();

  // The active workout must still be here — NOT the "Start Workout" empty state.
  await expect(page.getByText(/Add Set/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Finish Workout/i })
  ).toBeVisible();
});

test("dashboard updates after finishing workout", async ({ page }) => {
  await page.goto("/");
  await waitForReady(page);

  await startWorkoutAndCreateExercise(page);

  // Log a set: fill weight + reps.
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill("135");
  await numberInputs.nth(0).blur();
  await numberInputs.nth(1).fill("8");
  await numberInputs.nth(1).blur();

  await page.getByRole("button", { name: /Finish Workout/i }).click();
  await expect(page.getByText(/Workout Complete/i)).toBeVisible();

  // Go to dashboard — stats must reflect the finished session.
  await page.getByRole("button", { name: "Dashboard" }).click();

  // THIS WEEK sessions count should be 1, not 0.
  const sessionsBlock = page.getByText("sessions").locator("..");
  await expect(sessionsBlock).toContainText("1");

  // Recent sessions list should NOT say "No workouts yet".
  await expect(page.getByText(/No workouts yet/i)).toHaveCount(0);
});
