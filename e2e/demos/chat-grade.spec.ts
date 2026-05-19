import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "chat-grade";

test.describe("demo: chat grade", () => {
  test("records score and rubric areas related to chat grading", async ({ page }) => {
    await page.goto("/practice");
    await expectAuthenticated(page);
    await expect(page.getByTestId("practice-simulation-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /score|passed|rubric|standard|highest/i);
    const historySearch = page.getByPlaceholder(/search by name, simulation, or scenarios/i).first();
    if (await historySearch.isVisible().catch(() => false)) {
      await historySearch.scrollIntoViewIfNeeded();
      await pauseForDemo();
    }

    await saveDemoVideo(page, TOPIC);
  });
});
