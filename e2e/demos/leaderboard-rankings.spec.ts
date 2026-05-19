import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "leaderboard-rankings";

test.describe("demo: leaderboard rankings", () => {
  test("records ranked user rows and metric columns", async ({ page }) => {
    await page.goto("/leaderboard");
    await expectAuthenticated(page);
    await expect(page.getByTestId("leaderboard-table")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^leaderboard-row-/);
    await scrollToText(page, /rank|highest score|messages per session|quickest pass|attempts/i);

    await saveDemoVideo(page, TOPIC);
  });
});
