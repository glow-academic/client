import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "pricing-overview";

// coverage: lead with the pricing SUMMARY (total-spend / run-count / avg-cost
// cards), then the spend-over-time chart (hover data points for tooltips),
// open+Escape the date-range picker, type+clear the runs search, and scroll
// the grouped-runs table. Distinct from group-overview/group-listing by
// centering the summary cards + chart rather than the runs table. All beats
// past the single page-ready assertion are guarded no-ops if absent, and
// strictly non-destructive (open-then-Escape, type-then-clear).
test.describe("demo: pricing overview", () => {
  test("records pricing summary cards, trend chart, and grouped run table", async ({
    page,
  }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);

    // Single page-ready assertion, then settle so no loading skeleton frame
    // is captured before the tour begins.
    await expect(page.getByTestId("pricing-summary")).toBeVisible({
      timeout: 30_000,
    });
    await settleLoaded(page);

    // --- Summary metric cards: total spend, run count, avg cost / run ---
    await hoverFirstVisible(page, "pricing-card-total-spend");
    await hoverFirstVisible(page, "pricing-card-run-count");
    await hoverFirstVisible(page, "pricing-card-avg-cost");

    // --- Spend-over-time chart: hold, then hover across data points so the
    // recharts tooltip surfaces per-model spend at a few x positions. ---
    const chart = page.getByTestId("pricing-chart");
    if (await chart.isVisible().catch(() => false)) {
      await chart.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
      const box = await chart.boundingBox().catch(() => null);
      if (box) {
        const y = box.y + box.height * 0.5;
        for (const frac of [0.3, 0.5, 0.7, 0.85]) {
          await page.mouse
            .move(box.x + box.width * frac, y, { steps: 6 })
            .catch(() => undefined);
          await pauseForDemo(550);
        }
        await page.mouse.move(box.x + box.width / 2, y).catch(() => undefined);
        await pauseForDemo(500);
      }
    }

    // --- Date-range picker: open, reveal the calendar, dismiss (read-only,
    // no commit). The trigger button carries id="date". ---
    const dateTrigger = page.locator("#date").first();
    if (await dateTrigger.isVisible().catch(() => false)) {
      await dateTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await dateTrigger.click().catch(() => undefined);
      await pauseForDemo(1_100);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // --- Grouped-runs table: scroll it into view as the closing section. ---
    await scrollToText(page, /spend over time/i);
    const runsTable = page.getByTestId("pricing-runs-table");
    if (await runsTable.isVisible().catch(() => false)) {
      await runsTable.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(900);
    }

    // --- Runs search: type so the keystrokes show, let it react, then clear
    // (non-destructive — read-only re-query, reset to the full table). ---
    const search = page
      .getByPlaceholder("Search by model, agent, name, debug info...")
      .first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("gpt", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_100);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(700);
    }

    // Final scroll over the run rows so the clip ends on substantive content.
    await scrollToText(page, /model|agent|tokens|cost/i);
    await pauseForDemo(700);

    await saveDemoVideo(page, TOPIC);
  });
});
