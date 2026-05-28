// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "leaderboard-trends";

test.describe("demo: leaderboard trends", () => {
  test("records accolade cards and improvement-oriented metrics", async ({ page }) => {
    await page.goto("/leaderboard");
    await expectAuthenticated(page);
    await expect(page.getByTestId("leaderboard-container")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^accolade-/);
    await scrollToText(page, /highest scorer|rapid riser|marathon|persistent|perfect/i);

    await saveDemoVideo(page, TOPIC);
  });
});