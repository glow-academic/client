import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "activity-summary";

test.describe("demo: activity summary", () => {
  test("records the profile summary and a live session search", async ({ page }) => {
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    await expect(page.getByTestId("activity-container")).toBeVisible({ timeout: 30_000 });

    // Open on the LOADED, populated summary (single-viewport page — motion
    // comes from interaction, not scrolling).
    await settleLoaded(page);

    // Beat 1 — the profile summary: who has been active.
    await expect(page.getByTestId("activity-profile-summary")).toBeVisible();
    await hoverFirstVisible(page, "activity-profile-summary");
    await pauseForDemo(1_300);

    // Beat 2 — the problems panel: what needs attention.
    await hoverFirstVisible(page, "activity-problems");
    await pauseForDemo(1_200);

    // Beat 3 — drive a live search so the sessions table visibly narrows.
    const search = page.getByTestId("activity-search");
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await pauseForDemo(400);
      await search.pressSequentially("benchmark", { delay: 55 });
      await pauseForDemo(1_400);
      // Hover a resulting row to draw the eye to the filtered result.
      await hoverFirstVisible(page, /^activity-session-row-/);
      await pauseForDemo(1_300);
    } else {
      await hoverFirstVisible(page, /^activity-session-row-/);
      await pauseForDemo(1_400);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
