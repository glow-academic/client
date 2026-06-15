// # coverage: deep tour of the /analytics/reports attempt/report HISTORY table
// (distinct from reports-overview's toolbar tour and reports-trends' charts) —
// scroll the history table into view, hover several consecutive profile-history
// rows so the cursor tracks the populated leaderboard, hover a metric cell to
// reveal its per-attempt details HoverCard, exercise the table's own profile
// search (type live / clear), open a sortable column-header sort menu (Asc /
// Desc / Hide reveal), and open the pagination "Rows per page" select + reveal
// the page-nav controls. Every beat past the one page-ready assertion is guarded
// + non-destructive (search is reversible view state, cleared back to the full
// population; the sort menu and the page-size select are open-then-Escape
// reveals — no sort committed, no page size changed, no row mutated).
import { expect, test } from "@playwright/test";

import {
  expectAuthenticated,
  hoverFirstVisible,
  hoverLocatorIfVisible,
  scrollToText,
  settleLoaded,
} from "../helpers/demo-page";
import { pauseForDemo, saveDemoVideo } from "../helpers/demo-video";

const TOPIC = "reports-history";

test.describe("demo: reports history", () => {
  test("tours the report history table — row hovers, metric detail card, search, sort menu, and pagination controls", async ({
    page,
  }) => {
    await page.goto("/analytics/reports");
    await expectAuthenticated(page);
    // The loaded reports view carries `reports-table-container`; the loading
    // state renders skeletons (detached once data lands). This is the single
    // real page-ready assertion — keep exactly one.
    await expect(page.getByTestId("reports-table-container")).toBeVisible({ timeout: 30_000 });
    // Wait out the skeleton lead-in and hold a beat on the populated report.
    await settleLoaded(page);

    // BEAT 1 — scroll the history table's metric columns into view so the
    // populated per-profile attempt history (scores, completion, attempts, time)
    // fills the frame, then settle so no skeleton frame is captured mid-scroll.
    await scrollToText(page, /avg score|highest|completion|attempts|first pass|time spent/i);
    await pauseForDemo(1_000);

    // BEAT 2 — track the cursor across several consecutive profile-history rows
    // so the row-hover highlight visibly walks down the leaderboard. Each row is
    // a guarded no-op if absent (a thin report may render fewer rows).
    await hoverFirstVisible(page, /^reports-profile-row-/);
    const historyRows = page.getByTestId(/^reports-profile-row-/);
    const rowCount = await historyRows.count().catch(() => 0);
    for (let i = 1; i < Math.min(rowCount, 4); i++) {
      await hoverLocatorIfVisible(historyRows.nth(i));
    }
    await pauseForDemo(900);

    // BEAT 3 — hover an "Avg Score" metric cell to reveal its details HoverCard
    // (mean / median / mode breakdown of that profile's attempt history). The
    // card is a read-only reveal; move the cursor away after so it dismisses.
    const metricCell = page.getByText(/^\d+%$/).first();
    if (await metricCell.isVisible().catch(() => false)) {
      await metricCell.scrollIntoViewIfNeeded().catch(() => undefined);
      await metricCell.hover().catch(() => undefined);
      await pauseForDemo(1_300);
      // Move off the cell so the HoverCard closes (no committed state).
      await page.getByTestId("reports-table-container").hover({ position: { x: 5, y: 5 } }).catch(() => undefined);
      await pauseForDemo(700);
    }

    // BEAT 4 — type into the profile name/email search so the history table
    // visibly filters live to the matching profiles, let the rows re-query, then
    // clear it so the table returns to the full population. Reversible view state.
    const search = page.getByPlaceholder("Search profiles by name or email...").first();
    if (await search.isVisible().catch(() => false)) {
      await search.scrollIntoViewIfNeeded().catch(() => undefined);
      await search.click().catch(() => undefined);
      await search.pressSequentially("a", { delay: 55 }).catch(() => undefined);
      await pauseForDemo(1_400);
      await search.fill("").catch(() => undefined);
      await pauseForDemo(1_100);
    }

    // BEAT 5 — open a sortable history column-header sort menu (e.g. "Attempts"
    // or "Avg Score") to reveal its Asc / Desc / Hide options — the controls
    // that re-order the history rows — then dismiss with Escape WITHOUT
    // committing a sort. Reversible + non-destructive.
    const sortHeader = page
      .getByRole("button", { name: /attempts|avg score|highest|completion|time spent/i })
      .first();
    if (await sortHeader.isVisible().catch(() => false)) {
      await sortHeader.scrollIntoViewIfNeeded().catch(() => undefined);
      await sortHeader.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 6 — scroll to the pagination footer and open the "Rows per page"
    // select to reveal the page-size options (100 / 200 / … for the large
    // history table), then dismiss with Escape WITHOUT changing the size — a
    // resize would re-query, so this is an open-then-close reveal only.
    await scrollToText(page, /rows per page/i);
    const pageSizeTrigger = page.getByRole("combobox").first();
    if (await pageSizeTrigger.isVisible().catch(() => false)) {
      await pageSizeTrigger.scrollIntoViewIfNeeded().catch(() => undefined);
      await pageSizeTrigger.click().catch(() => undefined);
      await pauseForDemo(1_200);
      await page.keyboard.press("Escape").catch(() => undefined);
      await pauseForDemo(800);
    }

    // BEAT 7 — hover the page-navigation buttons so the prev/next history-page
    // controls read on frame, without clicking (advancing the page would re-query
    // the history). Open-ended hover reveal only.
    const nextPage = page.getByRole("button", { name: /go to next page/i }).first();
    await hoverLocatorIfVisible(nextPage);
    const prevPage = page.getByRole("button", { name: /go to previous page/i }).first();
    await hoverLocatorIfVisible(prevPage);
    await pauseForDemo(900);

    // End held on the populated history table — substantive content on frame.
    await scrollToText(page, /avg score|highest|attempts|time spent/i);
    await pauseForDemo(1_100);

    await saveDemoVideo(page, TOPIC);
  });
});
