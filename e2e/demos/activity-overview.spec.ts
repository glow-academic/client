// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "activity-overview";

test.describe("demo: activity overview", () => {
  test("records engagement metrics, profile summary, and session history", async ({ page }) => {
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    await expect(page.getByTestId("activity-container")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("activity-metrics")).toBeVisible();
    await pauseForDemo();

    await scrollToText(page, /sessions|active profiles|logins|emulations/i);
    await expect(page.getByTestId("activity-sessions-table")).toBeVisible();

    await saveDemoVideo(page, TOPIC);
  });
});