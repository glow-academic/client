import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "pricing-group-history";

// coverage: tour the GROUPED RUN HISTORY table on /analytics/pricing — the
// per-group ledger of spend over time. Lead with the runs table (page-ready),
// then exercise its history affordances end to end: open+Escape the
// date-range picker, type+clear the runs search, open+Escape the View
// (column-visibility) menu, toggle the Created sort header and revert it back
// to the default desc, sweep the spend-over-time chart via page.mouse.move
// (NEVER locator.hover on chart internals), and step pagination forward/back.
// Distinct from pricing-overview (which centers the summary cards + chart) by
// centering the grouped-runs TABLE and its sort/search/view/paginate controls.
// RE-FIX: every hover goes through hoverLocatorIfVisible (guarded isVisible +
// force + timeout) so no unguarded .hover() can time out on a present-but-
// non-actionable element. Every beat past the single page-ready assertion is a
// guarded no-op when its target is absent, and strictly non-destructive
// (open-then-Escape, type-then-clear, sort-then-revert — no committed change).
test.describe("demo: pricing group history", () => {
  test("records the grouped run history table and its search, sort, view, and pagination controls", async ({
    page,
  }) => {
    await page.goto("/analytics/pricing");
    await expectAuthenticated(page);

    // Single page-ready assertion, then settle so no loading-skeleton frame is
    // captured before the tour begins.
    await expect(page.getByTestId("pricing-runs-table")).toBeVisible({
      timeout: 30_000,
    });
    await settleLoaded(page);

    // --- Orient: scroll the grouped-runs history table into view and hold so
    // its columns (Created / Profile / Agents / Models / Runs / Tokens / Cost)
    // read as the centerpiece of the clip. ---
    const runsTable = page.getByTestId("pricing-runs-table");
    if (await runsTable.isVisible().catch(() => false)) {
      await runsTable.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(1_000);
    }
    await scrollToText(page, /runs|tokens|cost|created/i);

    // --- Summary cards + spend-over-time chart sit above the table; hover the
    // cards (guarded), then sweep the chart with page.mouse.move so the
    // recharts tooltip surfaces per-model spend without an unguarded hover on
    // any chart internal. ---
    await hoverLocatorIfVisible(page.getByTestId("pricing-card-total-spend"));
    await hoverLocatorIfVisible(page.getByTestId("pricing-card-avg-cost"));

    const chart = page.getByTestId("pricing-chart");
    if (await chart.isVisible().catch(() => false)) {
      await chart.scrollIntoViewIfNeeded().catch(() => undefined);
      await pauseForDemo(800);
      const box = await chart.boundingBox().catch(() => null);
      if (box) {
        const y = box.y + box.height * 0.5;
        for (const frac of [0.35, 0.55, 0.75]) {
          await page.mouse
            .move(box.x + box.width * frac, y, { steps: 6 })
            .catch(() => undefined);
          await pauseForDemo(520);
        }
        await page.mouse.move(box.x + box.width / 2, y).catch(() => undefined);
        await pauseForDemo(450);
      }
    }

    // --- Date-range picker: open, reveal the calendar, dismiss (read-only, no
    // commit). The trigger button carries id="date". ---
    const dateTrigger = page.locator("#date").first();
    if (await dateTrigger.isVisible().catch(() => false)) {
      await dateTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await dateTrigger.click().catch(() => undefined);
      await pauseForDemo(1_100);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // --- Runs search: type so the keystrokes show, let it re-query, then clear
    // (non-destructive read-only filter; reset back to the full history). ---
    const search = page
      .getByPlaceholder("Search by model, agent, name, debug info...")
      .first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search
        .pressSequentially("gpt", { delay: 55 })
        .catch(() => undefined);
      await pauseForDemo(1_100);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(700);
    }

    // --- View (column-visibility) menu: open the "Toggle columns" dropdown,
    // reveal the column checkboxes, dismiss with Escape (no toggle committed). ---
    const viewMenu = page.getByRole("button", { name: "View", exact: true });
    if (await viewMenu.isVisible().catch(() => false)) {
      await viewMenu.scrollIntoViewIfNeeded().catch(() => undefined);
      await viewMenu.click().catch(() => undefined);
      await pauseForDemo(1_000);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(500);
    }

    // --- Created sort header: open the header menu and flip to Asc, let the
    // table re-query, then flip back to Desc to RESTORE the default order
    // (sort-then-revert, no net change). ---
    const createdHeader = page.getByRole("button", {
      name: /^Created/,
    });
    if (await createdHeader.first().isVisible().catch(() => false)) {
      await createdHeader.first().scrollIntoViewIfNeeded().catch(() => undefined);
      await createdHeader.first().click().catch(() => undefined);
      await pauseForDemo(700);
      const ascItem = page.getByRole("menuitem", { name: /Asc/i }).first();
      if (await ascItem.isVisible().catch(() => false)) {
        await ascItem.click().catch(() => undefined);
        await pauseForDemo(1_100);
        // Revert: re-open and pick Desc to return to the default order.
        await createdHeader.first().click().catch(() => undefined);
        await pauseForDemo(600);
        const descItem = page.getByRole("menuitem", { name: /Desc/i }).first();
        if (await descItem.isVisible().catch(() => false)) {
          await descItem.click().catch(() => undefined);
          await pauseForDemo(900);
        } else {
          await page.keyboard.press("Escape").catch(() => undefined);
          await pauseForDemo(400);
        }
      } else {
        await page.keyboard.press("Escape").catch(() => undefined);
        await pauseForDemo(400);
      }
    }

    // --- Pagination: step to the next page of group history, hold, then step
    // back to page 1 (read-only navigation, returns to the starting view). ---
    const nextPage = page
      .getByRole("button", { name: /go to next page/i })
      .first();
    if (await nextPage.isVisible().catch(() => false)) {
      const enabled = await nextPage.isEnabled().catch(() => false);
      if (enabled) {
        await nextPage.scrollIntoViewIfNeeded().catch(() => undefined);
        await nextPage.click().catch(() => undefined);
        await pauseForDemo(1_100);
        const prevPage = page
          .getByRole("button", { name: /go to previous page/i })
          .first();
        if (await prevPage.isEnabled().catch(() => false)) {
          await prevPage.click().catch(() => undefined);
          await pauseForDemo(900);
        }
      }
    }

    // Final scroll over the run rows so the clip ends on substantive history.
    await scrollToText(page, /runs|tokens|cost/i);
    await pauseForDemo(700);

    await saveDemoVideo(page, TOPIC);
  });
});
