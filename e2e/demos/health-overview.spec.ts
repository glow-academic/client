import { expect, test } from "@playwright/test";

import { expectAuthenticated, settleLoaded } from "../helpers/demo-page";
import { saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "health-overview";

test.describe("demo: health overview", () => {
  test("records health KPIs and application metrics", async ({ page }) => {
    await page.goto("/health");
    await expectAuthenticated(page);
    await expect(page.locator('[data-page="logs-dashboard"]')).toBeVisible({ timeout: 30_000 });

    // Wait out the skeleton lead-in, then dwell on the Application Metrics +
    // service-health panels so the populated health view fills the clip.
    await settleLoaded(page, {
      scrollTexts: [/application metrics|database|redis|websocket|authentication/i],
    });

    await saveDemoVideo(page, TOPIC);
  });
});