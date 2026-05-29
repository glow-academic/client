import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "pricing-daily-cost";

test.describe("demo: pricing daily cost", () => {
  test("records daily cost trend and aggregate spend context", async ({ page }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);
    await expect(page.getByTestId("pricing-chart")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await hoverFirstVisible(page, "pricing-chart");
    await scrollToText(page, /daily|spend|total|average|cost/i);

    await saveDemoVideo(page, TOPIC);
  });
});