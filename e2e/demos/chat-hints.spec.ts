// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "chat-hints";

test.describe("demo: chat hints", () => {
  test("records the learner-facing simulation card before hint-enabled chat", async ({ page }) => {
    await page.goto("/practice");
    await expectAuthenticated(page);
    await expect(page.getByTestId("practice-simulation-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^start-simulation-/);
    await scrollToText(page, /persona|scenario|practice|start simulation/i);

    await saveDemoVideo(page, TOPIC);
  });
});