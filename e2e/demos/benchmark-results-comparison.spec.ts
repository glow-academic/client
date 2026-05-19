import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "benchmark-results-comparison";

test.describe("demo: benchmark results comparison", () => {
  test("records benchmark history and comparison columns", async ({ page }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);
    await expect(page.getByTestId("benchmark-eval-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /history|completed|score|models|view|continue/i);
    await scrollToText(page, /eval|rubric|status|created/i);

    await saveDemoVideo(page, TOPIC);
  });
});
