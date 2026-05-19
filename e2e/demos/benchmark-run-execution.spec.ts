import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "benchmark-run-execution";

test.describe("demo: benchmark run execution", () => {
  test("records the non-mutating start and retry controls for benchmark runs", async ({ page }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);
    await expect(page.getByTestId("benchmark-eval-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, /^start-infinite-/);
    await scrollToText(page, /start|try eval|retry|running|pending/i);

    await saveDemoVideo(page, TOPIC);
  });
});
