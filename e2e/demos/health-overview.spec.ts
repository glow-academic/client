import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "health-overview";

test.describe("demo: health overview", () => {
  test("records health KPIs and application metrics", async ({ page }) => {
    await page.goto("/health");
    await expectAuthenticated(page);
    await expect(page.locator('[data-page="logs-dashboard"]')).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /application metrics|database|redis|websocket|authentication/i);

    await saveDemoVideo(page, TOPIC);
  });
});
