// TODO: placeholder demo — not yet implemented (basic recording).
// Flesh out or wire to the engine helpers in helpers/crud-demos.ts.
import { expect, test } from "@playwright/test";

import { expectAuthenticated, hoverFirstVisible, scrollToText } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "pricing-overview";

test.describe("demo: pricing overview", () => {
  test("records pricing summary cards, trend chart, and run table", async ({ page }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);
    await expect(page.getByTestId("pricing-summary")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("pricing-chart")).toBeVisible();
    await pauseForDemo();

    await hoverFirstVisible(page, "pricing-card-total-spend");
    await hoverFirstVisible(page, "pricing-card-run-count");
    await scrollToText(page, /runs|cost|models|tokens/i);

    await saveDemoVideo(page, TOPIC);
  });
});