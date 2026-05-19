import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "leaderboard-overview";

test.describe("demo: leaderboard overview", () => {
  test("records leaderboard accolades and ranking table", async ({ page }) => {
    await page.goto("/leaderboard");
    await expectAuthenticated(page);
    await expect(page.getByTestId("leaderboard-container")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^accolade-/);
    await expect(page.getByTestId("leaderboard-table")).toBeVisible();
    await scrollToText(page, /rank|score|attempts|perfect|accolade/i);

    await saveDemoVideo(page, TOPIC);
  });
});
