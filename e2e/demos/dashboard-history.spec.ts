import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "dashboard-history";

// coverage: tour the dashboard's HISTORY / time-series TREND surface — scroll to
// the trend charts (Rubric Trend over time + Attempt Improvement), hover the
// plotted series so recharts tooltips read, exercise the toolbar date-range
// picker open+Escape (non-destructive, no commit), then type+clear the inline
// attempt-history search below the panels. Distinct from dashboard-header (top
// KPIs) and dashboard-rubric (rubric breakdown). Read-only throughout.

test.describe("demo: dashboard history", () => {
  test("tours the trend charts, date-range picker, and attempt history search", async ({
    page,
  }) => {
    await page.goto("/analytics/dashboard");
    await expectAuthenticated(page);
    await expect(page.getByTestId("dashboard-overview")).toBeVisible({
      timeout: 30_000,
    });
    // Wait out the loading shimmer so the populated trend panels — not the
    // skeleton — fill the opening frames.
    await settleLoaded(page);

    // --- Beat 1: the time-series TREND chart (Rubric Trend, first primary slide).
    // Average rubric scores over time by standard group.
    await scrollToText(page, /rubric trend|scores over time|standard group/i);
    const trendCard = page
      .locator("div", { hasText: /Average rubric scores over time/i })
      .last();
    if (await trendCard.isVisible().catch(() => false)) {
      await trendCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo();
      // Sweep across the plotted line so recharts surfaces its per-date tooltip.
      const plot = trendCard.locator(".recharts-surface").first();
      if (await plot.isVisible().catch(() => false)) {
        const box = await plot.boundingBox().catch(() => null);
        if (box) {
          await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
          await pauseForDemo(500);
          await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.45);
          await pauseForDemo(700);
        }
      }
    }
    // The actionable-insight strip under the trend chart.
    await hoverFirstVisible(page, "rubric-trend-insight");

    // --- Beat 2: the date-range picker that drives the trend window. Open the
    // calendar popover, hold so the two-month grid reads, then Escape WITHOUT
    // committing a new range (non-destructive — the trend stays as-is).
    const dateButton = page.locator("#date").first();
    if (await dateButton.isVisible().catch(() => false)) {
      await dateButton.scrollIntoViewIfNeeded().catch(() => undefined);
      await dateButton.click().catch(() => undefined);
      // The popover renders a react-day-picker calendar grid.
      const calendar = page.getByRole("grid").first();
      await calendar.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
      await pauseForDemo(1_100);
      await page.keyboard.press("Escape");
      await pauseForDemo();
    }

    // --- Beat 3: the second time-series panel — Attempt Improvement (performance
    // across multiple attempts). Live in the secondary carousel; advance to it
    // and hover the composed bars/line so its tooltip reads.
    await hoverFirstVisible(page, "dashboard-secondary-carousel-next");
    const improvementCard = page
      .locator("div", { hasText: /Performance improvement across multiple attempts/i })
      .last();
    if (await improvementCard.isVisible().catch(() => false)) {
      await improvementCard.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo();
      const plot = improvementCard.locator(".recharts-surface").first();
      if (await plot.isVisible().catch(() => false)) {
        const box = await plot.boundingBox().catch(() => null);
        if (box) {
          await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.55);
          await pauseForDemo(600);
          await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.45);
          await pauseForDemo(700);
        }
      }
    }

    // --- Beat 4: the inline attempt-history table below the panels — the
    // per-attempt ledger backing the trends. Type into its search so the typing
    // shows + it re-queries, hold, then CLEAR so the demo leaves no filter set.
    await scrollToText(page, /score|scenario|simulation|date|attempt|view/i);
    const historySearch = page
      .getByPlaceholder(/search by name, simulation, or scenarios/i)
      .first();
    if (await historySearch.isVisible().catch(() => false)) {
      await historySearch.scrollIntoViewIfNeeded().catch(() => undefined);
      await historySearch.click().catch(() => undefined);
      await historySearch.pressSequentially("confused", { delay: 55 });
      await historySearch.press("Enter");
      // Let the re-query land + the filtered rows settle on frame.
      await settleLoaded(page);
      // Non-destructive reset: clear the search so we leave the view as found.
      await historySearch.fill("");
      await historySearch.press("Enter");
      await pauseForDemo(900);
    }

    await saveDemoVideo(page, TOPIC);
  });
});
