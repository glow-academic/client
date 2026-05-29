import { expect, test } from "@playwright/test";
import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";
test.describe("demo: tests lifecycle", () => {
  test("benchmark/test runs and their statuses", async ({ page }) => {
    await page.goto("/benchmark");
    await expectAuthenticated(page);
    await expect(page.getByTestId("benchmark-eval-grid")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();
    await scrollToText(page, /test|eval|run|status|history|queued|complete/i);
    await saveDemoVideo(page, "tests-lifecycle");
  });
});
