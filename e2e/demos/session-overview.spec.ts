import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "session-overview";

test.describe("demo: session overview", () => {
  test("records the session row entry point from activity history", async ({ page }) => {
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    await expect(page.getByTestId("activity-sessions-table")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^activity-session-row-/);
    await scrollToText(page, /session|profile|active|tokens|cost/i);

    await saveDemoVideo(page, TOPIC);
  });
});
