import { expect, test } from "@playwright/test";

import { expectAuthenticated, scrollToText, settleLoaded } from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "health-overview";

// # coverage: TOURS the whole system-health dashboard — every KPI card (websocket
// /redis/database/authentication) opened to its trend dialog and dismissed, the
// Application Metrics chart hovered for tooltips, the toolbar date-range picker
// opened-and-Escaped, and the non-destructive Refresh re-query exercised. Every
// beat past the one page-ready assertion is a guarded no-op if its target is absent.

test.describe("demo: health overview", () => {
  test("records health KPIs and application metrics", async ({ page }) => {
    await page.goto("/health");
    await expectAuthenticated(page);

    // Single real page-ready assertion: the logs/health dashboard container.
    await expect(page.locator('[data-page="logs-dashboard"]')).toBeVisible({ timeout: 30_000 });

    // Wait out the loading skeleton so the populated KPI cards + Application
    // Metrics chart — not the blank shimmer — open the clip, then hold a beat.
    await settleLoaded(page);

    // Beat 1: dwell on the per-service KPI strip (websocket / redis / database /
    // authentication) sitting above the chart. Guarded no-op if a label is absent.
    await scrollToText(page, /websocket|redis|database|authentication/i);
    await pauseForDemo(1_200);

    // Beat 2: open EACH KPI card in turn. Each card is a clickable tile that
    // pops a trend dialog (status + latency + uptime/latency lines) — a rich,
    // fully non-destructive reveal. Open, hold so the trend reads, then Escape
    // to dismiss before moving to the next service. Each is independently
    // guarded so a service with no data (its card absent) is silently skipped.
    for (const service of [/^WebSocket$/, /^Redis$/, /^Database$/, /^Authentication$/]) {
      const card = page.getByText(service).first();
      if (await card.isVisible().catch(() => false)) {
        await card.scrollIntoViewIfNeeded().catch(() => undefined);
        await card.click().catch(() => undefined);
        // Let the dialog (and its recharts trend) render, then hold on it.
        const trendTitle = page.getByText(/health trend/i).first();
        if (await trendTitle.isVisible().catch(() => false)) {
          await pauseForDemo(1_400);
        } else {
          await pauseForDemo(900);
        }
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(600);
      }
    }

    // Beat 3: bring the Application Metrics chart fully into frame and hold so
    // the rendered lines (cpu / latency / memory / requests / errors) read.
    await scrollToText(page, /application metrics/i);
    await pauseForDemo(1_200);

    // Beat 4: hover the chart so recharts surfaces its tooltip — proves the
    // multi-series metrics are live, not a static image. Guarded: a no-op if
    // the metrics surface line isn't present (empty series).
    const metricsLine = page.locator('[data-page="logs-dashboard"] .recharts-line').first();
    if (await metricsLine.isVisible().catch(() => false)) {
      const box = await metricsLine.boundingBox().catch(() => null);
      if (box) {
        await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5).catch(() => undefined);
        await pauseForDemo(900);
        await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5).catch(() => undefined);
        await pauseForDemo(900);
      }
    }

    // Beat 5: open the toolbar date-range filter to show the metrics are
    // scopable. The popover trigger reads "Filter by date" (id="date").
    // Guarded: a no-op if the control is absent.
    const dateTrigger = page.locator("#date").first();
    if (await dateTrigger.isVisible().catch(() => false)) {
      await dateTrigger.click().catch(() => undefined);
      await pauseForDemo(1_200);

      // Hover a day cell in the opened calendar so the interaction reads as
      // deliberate, then close WITHOUT committing a range (non-destructive —
      // we only reveal the control, we don't refilter/reload the page).
      const dayCell = page.getByRole("gridcell").filter({ hasText: /^15$/ }).first();
      if (await dayCell.isVisible().catch(() => false)) {
        await dayCell.hover().catch(() => undefined);
        await pauseForDemo(1_000);
      }
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(700);
    }

    // Beat 6: exercise the non-destructive Refresh control — it re-runs the
    // read-only health query (spinner animates) without mutating anything.
    // Shows the dashboard is live + refreshable. Guarded no-op if absent.
    const refreshBtn = page.getByRole("button", { name: /^Refresh$/i }).first();
    if (await refreshBtn.isVisible().catch(() => false)) {
      await refreshBtn.click().catch(() => undefined);
      await pauseForDemo(1_200);
    }

    // End on the populated chart so the clip closes substantive.
    await scrollToText(page, /application metrics/i);
    await pauseForDemo(1_300);

    await saveDemoVideo(page, TOPIC);
  });
});
