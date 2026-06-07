import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverLocatorIfVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "pricing-model-breakdown";

test.describe("demo: pricing model breakdown", () => {
  test("records model filters and model-level cost columns", async ({ page }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);
    const runsTable = page.getByTestId("pricing-runs-table");
    await expect(runsTable).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    // Scroll to the actual runs table (not the above-the-fold header that
    // `scrollToText(/model|…/)` was matching), so the model-level cost columns
    // — the thing this demo showcases — are on camera before the save.
    await runsTable.scrollIntoViewIfNeeded().catch(() => undefined);
    await pauseForDemo();
    await scrollToText(page, /model|input|output|tokens|cost/i);
    await hoverLocatorIfVisible(page.getByRole("button", { name: /model/i }));

    await saveDemoVideo(page, TOPIC);
  });
});