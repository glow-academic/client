import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "session-detail-view";

test.describe("demo: session detail view", () => {
  test("records the activity row that opens a full session detail page", async ({ page }) => {
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    await expect(page.getByTestId("activity-sessions-table")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^activity-session-row-/);
    await scrollToText(page, /view|session|groups|runs|messages/i);

    await saveDemoVideo(page, TOPIC);
  });
});
