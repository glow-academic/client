import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "benchmark-overview";

test.describe("demo: benchmark overview", () => {
  test("records the benchmark eval catalog and launch affordances", async ({ page }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);
    await expect(page.getByTestId("benchmark-eval-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^eval-card-/);
    await scrollToText(page, /models|completed|pending|runs|infinite/i);

    await saveDemoVideo(page, TOPIC);
  });
});