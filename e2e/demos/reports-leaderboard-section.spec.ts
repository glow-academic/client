import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "reports-leaderboard-section";

test.describe("demo: reports leaderboard section", () => {
  test("records embedded leaderboard rows in reports", async ({ page }) => {
    await page.goto("/analytics/reports");
    await expectAuthenticated(page);
    await expect(page.getByTestId("reports-table-container")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^reports-profile-row-/);
    await scrollToText(page, /rank|profile|highest score|messages per session|stagnation/i);

    await saveDemoVideo(page, TOPIC);
  });
});
