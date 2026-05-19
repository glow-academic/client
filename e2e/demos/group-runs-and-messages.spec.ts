import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverLocatorIfVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "group-runs-and-messages";

test.describe("demo: group runs and messages", () => {
  test("records run grouping, token totals, and drill-in affordances", async ({ page }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);
    await expect(page.getByTestId("pricing-runs-table")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /runs|messages|input|output|tokens|cost/i);
    await hoverLocatorIfVisible(page.getByRole("link").filter({ hasText: /view|open|run|group/i }));

    await saveDemoVideo(page, TOPIC);
  });
});
