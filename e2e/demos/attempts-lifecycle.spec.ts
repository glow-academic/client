import { expect, test } from "@playwright/test";
import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

test.describe("demo: attempts lifecycle", () => {
  test("attempt status states on the home deck", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);
    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });

    // The SimulationProgress cards carry the attempt-lifecycle badges
    // (passed / in-progress / not-started) — the substantive screen for this
    // slot. Wait out the skeleton, then dwell + tour the status indicators so
    // the loaded lifecycle states, not the shimmer, fill the clip.
    await settleLoaded(page, {
      scrollTexts: [/passed|in progress|not started|completed|attempt/i],
      hoverTestIds: [/^simulation-progress-/],
    });

    await saveDemoVideo(page, "attempts-lifecycle");
  });
});
