import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "group-overview";

test.describe("demo: group overview", () => {
  test("records grouped AI run analytics from the pricing history surface", async ({ page }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);
    await expect(page.getByTestId("pricing-runs-table")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /group|runs|models|profile|cost/i);
    await page.getByPlaceholder("Search by model, agent, name, debug info...").fill("group");
    await pauseForDemo();

    await saveDemoVideo(page, TOPIC);
  });
});
