import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "activity-summary";

test.describe("demo: activity summary", () => {
  test("records the profile summary and problem panels", async ({ page }) => {
    await page.goto("/analytics/activity");
    await expectAuthenticated(page);
    await expect(page.getByTestId("activity-container")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await expect(page.getByTestId("activity-profile-summary")).toBeVisible();
    await scrollToText(page, /profile|sessions|logins|grants|problems/i);
    await expect(page.getByTestId("activity-problems")).toBeVisible();

    await saveDemoVideo(page, TOPIC);
  });
});