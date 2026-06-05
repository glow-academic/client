import { expect, test } from "@playwright/test";
import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "practice-overview";

test.describe("demo: practice overview", () => {
  test("records the practice landing page", async ({ page }) => {
    await page.goto("/practice");
    // Don't `waitForLoadState("networkidle")` — the page keeps an SSE /
    // socket open, so networkidle never fires. Wait for the grid
    // itself (its visibility is the real "page ready" signal — the grid
    // renders only on the loaded, populated state, never the skeleton).

    await expectAuthenticated(page);

    const grid = page.getByTestId("practice-simulation-grid");
    await expect(grid).toBeVisible({ timeout: 30_000 });

    // Let the loading skeleton detach, then dwell + tour the real, populated
    // cards so the LOADED screen — not the shimmer — dominates the clip.
    await settleLoaded(page, {
      scrollTexts: [/practice|simulation|start|score/i],
      hoverTestIds: [/^start-simulation-/, "simulation-title"],
    });

    await saveDemoVideo(page, TOPIC);
  });
});
