import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "activity-overview";

test.describe("demo: activity overview", () => {
  test("records engagement metrics, problems, and session history", async ({ page }) => {
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    await expect(page.getByTestId("activity-container")).toBeVisible({ timeout: 30_000 });

    // Open on the LOADED, populated view (skeleton trimmed by settle).
    await settleLoaded(page);

    // Beat 1 — the engagement metrics / stat cards.
    await expect(page.getByTestId("activity-metrics")).toBeVisible();
    await page.getByTestId("activity-metrics").scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseForDemo(1_300);

    // Beat 2 — the profile summary panel.
    await scrollToText(page, /active profiles|logins|emulations|profile/i);
    await hoverFirstVisible(page, "activity-profile-summary");
    await pauseForDemo(1_200);

    // Beat 3 — the problems panel (where attention is needed).
    await scrollToText(page, /problems|attention|flagged|issues/i);
    await hoverFirstVisible(page, "activity-problems");
    await pauseForDemo(1_200);

    // Beat 4 — the session history table, hovering a row to draw the eye.
    await expect(page.getByTestId("activity-sessions-table")).toBeVisible();
    await page.getByTestId("activity-sessions-table").scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseForDemo(900);
    await hoverFirstVisible(page, /^activity-session-row-/);
    await pauseForDemo(1_400);

    await saveDemoVideo(page, TOPIC);
  });
});
