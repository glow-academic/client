// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "attempts-overview";

test.describe("demo: attempts overview", () => {
  test("records assigned simulations, attempt progress, and attempt history", async ({ page }) => {
    await page.goto("/home");
    await expectAuthenticated(page);
    await expect(page.getByTestId("home-overview")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^simulation-progress-/);
    await hoverFirstVisible(page, "simulation-title");
    await scrollToText(page, /passed|in progress|not started|attempt|simulation/i);

    await saveDemoVideo(page, TOPIC);
  });
});