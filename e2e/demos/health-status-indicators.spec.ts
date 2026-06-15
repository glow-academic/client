import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "health-status-indicators";

// # coverage: tour the whole system-health page — every service status card +
// its trend dialog, the application-metrics chart, and the read-only toolbar
// affordances (date-range popover, refresh, export) — all open-then-dismiss,
// non-destructive on the live instance.
test.describe("demo: health status indicators", () => {
  test("records service status cards and latency indicators", async ({ page }) => {
    await page.goto("/health");
    await expectAuthenticated(page);
    await expect(page.locator('[data-page="logs-dashboard"]')).toBeVisible({
      timeout: 30_000,
    });
    // Settle out the loading shimmer so the opening frames are the populated
    // dashboard, not a skeleton.
    await settleLoaded(page);

    // 1) Tour the four service status cards top-to-back. Each card carries a
    //    status dot + current latency; hover holds a beat on each so the
    //    indicators read on frame.
    const cardLabels = [/^WebSocket$/, /^Redis$/, /^Database$/, /^Authentication$/];
    for (const label of cardLabels) {
      await hoverLocatorIfVisible(page.getByText(label));
    }

    // 2) Open ONE service's trend dialog so its uptime/latency chart + status
    //    detail reads, then dismiss with Escape (read-only, non-destructive).
    const wsCard = page.getByText(/^WebSocket$/).first();
    if (await wsCard.isVisible().catch(() => false)) {
      await wsCard.click();
      // The dialog title "<Service> Health Trend" confirms the modal opened.
      const trendTitle = page.getByText(/Health Trend/i).first();
      if (await trendTitle.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await scrollToText(page, /Current Latency/i);
        await scrollToText(page, /Healthy|Unhealthy/i);
        await pauseForDemo(1_200);
      }
      await page.keyboard.press("Escape");
      await pauseForDemo(700);
    }

    // 3) Scroll to the application-metrics line chart and hold so the CPU /
    //    latency / memory / requests / errors series read.
    await scrollToText(page, /Application Metrics/i);
    await pauseForDemo(1_000);

    // 4) Open the date-range picker popover, reveal the calendar, dismiss with
    //    Escape WITHOUT committing a new range (no day click) — keeps the live
    //    view unfiltered.
    const dateButton = page.locator("#date").first();
    if (await dateButton.isVisible().catch(() => false)) {
      await dateButton.scrollIntoViewIfNeeded().catch(() => undefined);
      await dateButton.click();
      // The calendar grid surfaces on open; hold so the picker reads.
      const calendar = page.getByRole("grid").first();
      if (await calendar.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await pauseForDemo(1_200);
      } else {
        await pauseForDemo(700);
      }
      await page.keyboard.press("Escape");
      await pauseForDemo(600);
    }

    // 5) Surface the read-only toolbar controls (refresh + export) without
    //    invoking them — hover holds a beat so they read on frame.
    await hoverLocatorIfVisible(page.getByRole("button", { name: /Refresh/i }));
    await hoverLocatorIfVisible(page.getByRole("button", { name: /Download CSV/i }));

    // End on the populated dashboard.
    await scrollToText(page, /Application Metrics/i);
    await pauseForDemo(800);

    await saveDemoVideo(page, TOPIC);
  });
});
