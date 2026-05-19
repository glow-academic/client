import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "chat-overview";

test.describe("demo: chat overview", () => {
  test("records the practice entry point that opens an attempt chat", async ({ page }) => {
    await page.goto("/practice");
    await expectAuthenticated(page);
    await expect(page.getByTestId("practice-simulation-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^start-simulation-/);
    await scrollToText(page, /start simulation|scenario|persona|time limit/i);

    await saveDemoVideo(page, TOPIC);
  });
});
