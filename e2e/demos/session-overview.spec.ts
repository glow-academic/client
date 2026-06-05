import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "session-overview";

test.describe("demo: session overview", () => {
  test("records the session row entry point from activity history", async ({ page }) => {
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    await expect(page.getByTestId("activity-sessions-table")).toBeVisible({ timeout: 30_000 });

    // Wait out the skeleton lead-in, then tour the loaded session rows.
    await settleLoaded(page, {
      hoverTestIds: [/^activity-session-row-/],
      scrollTexts: [/session|profile|active|tokens|cost/i],
    });

    await saveDemoVideo(page, TOPIC);
  });
});