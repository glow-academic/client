// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "home-assigned";

test.describe("demo: home assigned simulations", () => {
  test("records assigned simulation progress and launch cards", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);
    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^simulation-progress-/);
    await scrollToText(page, /passed|in progress|not started|pass/i);
    await hoverFirstVisible(page, /^start-simulation-/);

    await saveDemoVideo(page, TOPIC);
  });
});