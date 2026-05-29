import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "session-navigate-to-group";

test.describe("demo: session navigate to group", () => {
  test("records group/run metadata surfaced from session history", async ({ page }) => {
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    await expect(page.getByTestId("activity-sessions-table")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^activity-session-row-/);
    await scrollToText(page, /group|runs|tokens|messages|session/i);

    await saveDemoVideo(page, TOPIC);
  });
});