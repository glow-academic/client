// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";
import { expectAuthenticated } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "practice-overview";

test.describe("demo: practice overview", () => {
  test("records the practice landing page", async ({ page }) => {
    await page.goto("/practice");
    // Don't `waitForLoadState("networkidle")` — the page keeps an SSE /
    // socket open, so networkidle never fires. Wait for the grid
    // itself (its visibility is the real "page ready" signal).

    await expectAuthenticated(page);

    const grid = page.getByTestId("practice-simulation-grid");
    await expect(grid).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    const firstStartButton = page.getByTestId(/^start-simulation-/).first();
    if (await firstStartButton.isVisible().catch(() => false)) {
      await firstStartButton.scrollIntoViewIfNeeded();
      await pauseForDemo();
    }

    await saveDemoVideo(page, TOPIC);
  });
});