import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "practice-retry";

test.describe("demo: practice retry", () => {
  test("records retry/start affordances without launching a live attempt", async ({ page }) => {
    await page.goto("/practice");
    await expectAuthenticated(page);
    await expect(page.getByTestId("practice-simulation-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^start-simulation-/);
    await scrollToText(page, /retry|start simulation|highest score|sessions/i);

    await saveDemoVideo(page, TOPIC);
  });
});
