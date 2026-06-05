import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  waitOutSkeleton,
} from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "leaderboard-overview";

test.describe("demo: leaderboard overview", () => {
  test("records leaderboard accolades and ranking table", async ({ page }) => {
    await page.goto("/leaderboard");
    await expectAuthenticated(page);
    // The loaded container carries `leaderboard-container`; the loading state
    // is `leaderboard-skeleton`, so this resolves uniquely to the loaded view.
    await expect(page.getByTestId("leaderboard-container")).toBeVisible({ timeout: 30_000 });
    // Wait out the skeleton lead-in so the populated leaderboard fills the clip.
    await waitOutSkeleton(page);

    await hoverFirstVisible(page, /^accolade-/);
    await expect(page.getByTestId("leaderboard-table")).toBeVisible();
    await scrollToText(page, /rank|score|attempts|perfect|accolade/i);

    await saveDemoVideo(page, TOPIC);
  });
});