import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "group-listing";

test.describe("demo: group listing", () => {
  test("records listing controls for grouped model activity", async ({ page }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);
    await expect(page.getByTestId("pricing-runs-table")).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await page.getByPlaceholder("Search by model, agent, name, debug info...").fill("agent");
    await pauseForDemo();
    await scrollToText(page, /filter|model|profile|actor|pagination|rows/i);

    await saveDemoVideo(page, TOPIC);
  });
});