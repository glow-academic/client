import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverLocatorIfVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "health-status-indicators";

test.describe("demo: health status indicators", () => {
  test("records service status cards and latency indicators", async ({ page }) => {
    await page.goto("/health");
    await expectAuthenticated(page);
    await expect(page.locator('[data-page="logs-dashboard"]')).toBeVisible({ timeout: 30_000 });
    await pauseForDemo();

    await scrollToText(page, /ok|healthy|latency|uptime|error|ms/i);
    await hoverLocatorIfVisible(page.getByText(/database|redis|websocket|authentication/i));

    await saveDemoVideo(page, TOPIC);
  });
});