// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "activity-session-history";

test.describe("demo: activity session history", () => {
  test("records session search and drill-in rows", async ({ page }) => {
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    await expect(page.getByTestId("activity-container")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await page.getByTestId("activity-search").fill("session");
    await pauseForDemo();
    await expect(page.getByTestId("activity-sessions-table")).toBeVisible();
    await hoverFirstVisible(page, /^activity-session-row-/);
    await scrollToText(page, /tokens|cost|messages|attempts|runs/i);

    await saveDemoVideo(page, TOPIC);
  });
});