import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "pricing-group-history";

test.describe("demo: pricing group history", () => {
  test("records the grouped run history table and search controls", async ({ page }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);
    await expect(page.getByTestId("pricing-runs-table")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await page.getByPlaceholder("Search by model, agent, name, debug info...").fill("model");
    await pauseForDemo();
    await scrollToText(page, /group|models|runs|profile|actor|cost/i);

    await saveDemoVideo(page, TOPIC);
  });
});
