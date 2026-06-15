import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "dashboard-rubric";

// coverage: tours the dashboard's PRIMARY rubric-performance section end to end —
// the skill-area correlation heatmap (hover cells), the per-panel rubric filter
// picker (open + search + Escape, no commit), the carousel across all three rubric
// panels (heatmap -> rubric trend -> skill-performance radar), and the trend
// insight. Read-only and non-destructive: every beat past the page-ready assertion
// no-ops if its target is absent.
test.describe("demo: dashboard rubric breakdown", () => {
  test("records the rubric heatmap, filter picker, trend, and skill radar panels", async ({
    page,
  }) => {
    await page.goto("/analytics/dashboard");
    await expectAuthenticated(page);
    await expect(page.getByTestId("dashboard-overview")).toBeVisible({ timeout: 30_000 });
    // Trim the loading shimmer so the populated rubric section fills the frame.
    await settleLoaded(page);

    // --- Anchor on the rubric/skill performance section ---
    await scrollToText(page, /skill area correlation|correlation matrix|skill performance|rubric/i);

    // The primary carousel (heatmap / trend / skill radar) only reveals its nav
    // arrows when the panel region is hovered. Hover the first matrix card so the
    // controls fade in, then linger on the populated heatmap.
    const heatmapTitle = page
      .getByText(/skill area correlation matrix|correlation matrix/i)
      .first();
    if (await heatmapTitle.isVisible().catch(() => false)) {
      await heatmapTitle.hover().catch(() => undefined);
      await pauseForDemo();
    }

    // Hover heatmap correlation cells so their tooltip (Pearson r / data points)
    // reads on frame. The cells are mono-font score chips inside the matrix table.
    const cells = page.locator("td .font-mono");
    const cellCount = await cells.count().catch(() => 0);
    for (const idx of [0, 1]) {
      if (idx < cellCount) {
        const cell = cells.nth(idx);
        if (await cell.isVisible().catch(() => false)) {
          await cell.hover().catch(() => undefined);
          await pauseForDemo(650);
        }
      }
    }

    // --- Open the per-panel rubric filter picker (read-only view filter) ---
    // Open, reveal the searchable rubric list, type to show it react, then Escape
    // WITHOUT committing a selection (no re-query mutation).
    const rubricPicker = page
      .getByRole("combobox", { name: /select item/i })
      .first();
    if (await rubricPicker.isVisible().catch(() => false)) {
      await rubricPicker.scrollIntoViewIfNeeded().catch(() => undefined);
      await rubricPicker.click().catch(() => undefined);
      await pauseForDemo(700);
      const search = page.getByPlaceholder(/^search/i).first();
      if (await search.isVisible().catch(() => false)) {
        await search.pressSequentially("comm", { delay: 55 }).catch(() => undefined);
        await pauseForDemo(700);
        await search.fill("").catch(() => undefined);
        await pauseForDemo(400);
      }
      // Dismiss without selecting — keeps the view filter unchanged.
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // --- Advance the carousel: heatmap -> rubric trend -> skill radar ---
    // The next arrow is a real button; click it to surface the next rubric panel,
    // settling between beats so no transition frame dominates. Read-only nav.
    const nextArrow = page.getByTestId("dashboard-primary-carousel-next").first();
    for (const _ of [0, 1]) {
      if (await nextArrow.isVisible().catch(() => false)) {
        await nextArrow.click().catch(() => undefined);
        await pauseForDemo(1_000);
      }
    }

    // On the rubric-trend panel, hold on the AI insight summary line.
    await hoverFirstVisible(page, "rubric-trend-insight");
    await scrollToText(page, /average rubric scores|rubric trend|skill performance|teaching competencies/i);
    await pauseForDemo(600);

    await saveDemoVideo(page, TOPIC);
  });
});
