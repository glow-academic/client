import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "leaderboard-scoping";

test.describe("demo: leaderboard scoping", () => {
  test("records leaderboard search and scoping controls", async ({ page }) => {
    await page.goto("/leaderboard");
    await expectAuthenticated(page);
    await expect(page.getByTestId("leaderboard-container")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    const search = page.getByPlaceholder(/search users by name/i);
    if (await search.isVisible().catch(() => false)) {
      await search.fill("ta");
      await pauseForDemo();
    }
    await scrollToText(page, /cohort|simulation|date|rankings|filters/i);

    await saveDemoVideo(page, TOPIC);
  });
});
