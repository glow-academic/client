import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "chat-draft";

test.describe("demo: chat draft", () => {
  test("records the pre-chat configuration context for draftable chat resources", async ({ page }) => {
    await page.goto("/practice");
    await expectAuthenticated(page);
    await expect(page.getByTestId("practice-simulation-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^simulation-card-/);
    await scrollToText(page, /persona|documents|scenario|rubric|practice/i);

    await saveDemoVideo(page, TOPIC);
  });
});
