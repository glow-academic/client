import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "session-timeline";

test.describe("demo: session timeline", () => {
  test("records timeline-related session metadata from the activity surface", async ({ page }) => {
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    await expect(page.getByTestId("activity-sessions-table")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^activity-session-row-/);
    await scrollToText(page, /created|updated|active|timeline|session/i);

    await saveDemoVideo(page, TOPIC);
  });
});