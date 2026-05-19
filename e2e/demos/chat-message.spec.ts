import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "chat-message";

test.describe("demo: chat message", () => {
  test("records where a learner starts the chat message flow", async ({ page }) => {
    await page.goto("/practice");
    await expectAuthenticated(page);
    await expect(page.getByTestId("practice-simulation-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^start-simulation-/);
    await scrollToText(page, /chat|message|start simulation|practice/i);

    await saveDemoVideo(page, TOPIC);
  });
});
