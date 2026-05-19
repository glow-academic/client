import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "home-overview";

test.describe("demo: home overview", () => {
  test("records the learner home page", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);

    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^simulation-progress-/);
    await hoverFirstVisible(page, /^start-simulation-/);

    await saveDemoVideo(page, TOPIC);
  });
});
