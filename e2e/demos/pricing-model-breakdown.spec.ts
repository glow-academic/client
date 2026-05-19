import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverLocatorIfVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "pricing-model-breakdown";

test.describe("demo: pricing model breakdown", () => {
  test("records model filters and model-level cost columns", async ({ page }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);
    await expect(page.getByTestId("pricing-runs-table")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /model|input|output|tokens|cost/i);
    await hoverLocatorIfVisible(page.getByRole("button", { name: /model/i }));

    await saveDemoVideo(page, TOPIC);
  });
});
